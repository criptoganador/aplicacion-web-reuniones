import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testDelete() {
  const userId = 26; // The ID from the user's error report
  try {
    console.log(`Attempting to delete user ${userId}...`);
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    console.log("Success!");
  } catch (err) {
    console.error("❌ Error during deletion:", err.message);
    if (err.detail) console.error("Detail:", err.detail);
    if (err.table) console.error("Table:", err.table);
    if (err.constraint) console.error("Constraint:", err.constraint);
  } finally {
    process.exit(0);
  }
}

testDelete();
