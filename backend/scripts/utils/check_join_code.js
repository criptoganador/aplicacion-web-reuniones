import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkJoinCode(code) {
  try {
    const res = await pool.query(
      "SELECT * FROM organizations WHERE join_code = $1",
      [code],
    );
    console.log("--- ORG DATA ---");
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkJoinCode("5O4IZ4");
