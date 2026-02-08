import pg from "pg";
import dotenv from "dotenv";
import { RoomServiceClient } from "livekit-server-sdk";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const roomName = "uxl-sxlx-gzi";

async function checkStatus() {
  console.log(`--- Checking status for room: ${roomName} ---`);

  try {
    // 1. Check Database
    const dbResult = await pool.query(
      "SELECT id, link, is_active, created_at FROM meetings WHERE link = $1",
      [roomName],
    );

    if (dbResult.rows.length === 0) {
      console.log("❌ Database: Room not found.");
    } else {
      const meeting = dbResult.rows[0];
      console.log(`✅ Database: Found meeting (ID: ${meeting.id})`);
      console.log(`   Status: ${meeting.is_active ? "ACTIVE" : "INACTIVE"}`);
      console.log(`   Created at: ${meeting.created_at}`);
    }

    // 2. Check LiveKit
    const svc = new RoomServiceClient(
      process.env.LIVEKIT_URL || "https://miradioip-yposn36u.livekit.cloud",
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );

    try {
      const rooms = await svc.listRooms([roomName]);
      if (rooms.length > 0) {
        console.log(`✅ LiveKit: Room exists.`);
        const participants = await svc.listParticipants(roomName);
        console.log(`   Participants: ${participants.length}`);
      } else {
        console.log("❌ LiveKit: Room does not exist.");
      }
    } catch (lkErr) {
      console.error(`❌ LiveKit Error: ${lkErr.message}`);
    }
  } catch (err) {
    console.error(`❌ Error checking status: ${err.message}`);
  } finally {
    await pool.end();
  }
}

checkStatus();
