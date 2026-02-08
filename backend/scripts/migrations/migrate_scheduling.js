import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    console.log(
      "🚀 Starting migration: Adding title and scheduled_time columns...",
    );
    await pool.query(`
      ALTER TABLE meetings 
      ADD COLUMN IF NOT EXISTS title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP WITH TIME ZONE;
    `);
    console.log("✅ Columns added successfully.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await pool.end();
  }
}

migrate();
