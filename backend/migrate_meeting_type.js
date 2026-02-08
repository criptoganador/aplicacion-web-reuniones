import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    console.log("🚀 Starting migration: Adding meeting_type column...");
    await pool.query(`
      ALTER TABLE meetings 
      ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(20) DEFAULT 'instant';
    `);
    console.log("✅ Column meeting_type added successfully.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await pool.end();
  }
}

migrate();
