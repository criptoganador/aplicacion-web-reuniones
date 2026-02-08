import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
    console.log("Users Table Columns:");
    console.table(res.rows);

    // Check if password and email exist
    const columns = res.rows.map((r) => r.column_name);
    if (!columns.includes("email")) {
      console.log("Adding 'email' column...");
      await pool.query(
        "ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE;",
      );
    }
    if (!columns.includes("password")) {
      console.log("Adding 'password' column...");
      await pool.query("ALTER TABLE users ADD COLUMN password VARCHAR(255);");
    }

    console.log("Schema check/update complete.");
  } catch (err) {
    console.error("Error checking schema:", err);
  } finally {
    await pool.end();
  }
}

checkSchema();
