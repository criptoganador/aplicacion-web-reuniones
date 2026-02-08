import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Configuración Neon (SEGURA)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

pool.on("error", (err) => {
  console.error("❌ DB Pool Error:", err.message);
});

export const initDB = async () => {
  console.log("🔍 Intentando conectar a la Base de Datos...");
  try {
    const client = await pool.connect();
    console.log("✅ Base de Datos inicializada correctamente.");
    client.release();
  } catch (err) {
    console.error(
      "❌ Error fatal al conectar con la Base de Datos:",
      err.message,
    );
  }
};
