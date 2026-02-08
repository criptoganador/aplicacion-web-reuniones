import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkUser(email) {
  try {
    const res = await pool.query(
      "SELECT id, name, email, is_verified, verification_token, role FROM users WHERE email = $1",
      [email],
    );
    console.log("--- USER DATA ---");
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkUser("alexisgavidia21@gmail.com");
