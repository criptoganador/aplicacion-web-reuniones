import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'meetings'
    `);
    console.log(
      "Meetings Columns:",
      cols.rows.map((r) => r.column_name),
    );
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    process.exit(0);
  }
}
check();
