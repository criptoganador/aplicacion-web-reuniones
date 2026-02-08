import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verifyUser(email) {
  try {
    const res = await pool.query(
      "UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE email = $1 RETURNING id, email, is_verified",
      [email],
    );
    console.log("--- UPDATE RESULT ---");
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

verifyUser("alexisgavidia21@gmail.com");
