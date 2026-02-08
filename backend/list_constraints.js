import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT constraint_name, table_name 
      FROM information_schema.table_constraints 
      WHERE table_name IN ('participants', 'meetings') 
      AND constraint_type = 'FOREIGN KEY'
    `);
    console.log("Constraints:", res.rows);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    process.exit(0);
  }
}
check();
