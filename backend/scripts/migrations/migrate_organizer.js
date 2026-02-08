import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    console.log("🚀 Starting migration: Adding organized_by column...");
    await pool.query(`
      ALTER TABLE meetings 
      ADD COLUMN IF NOT EXISTS organized_by VARCHAR(100);
    `);
    console.log("✅ Column organized_by added successfully.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await pool.end();
  }
}

migrate();
