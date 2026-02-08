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
    console.log("✅ Conexión establecida. Verificando tablas...");

    // 1. ✨ CREACIÓN DE TABLAS
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        join_code TEXT UNIQUE,
        logo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        avatar_url TEXT,
        is_verified BOOLEAN DEFAULT TRUE,
        verification_token TEXT,
        reset_token TEXT,
        reset_token_expiry BIGINT,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        host_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        link TEXT UNIQUE NOT NULL,
        meeting_type TEXT DEFAULT 'instant',
        title TEXT,
        scheduled_time TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_files (
        id SERIAL PRIMARY KEY,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        filename TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. ✨ MIGRACIONES Y REFUERZOS
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM organizations LIMIT 1) THEN
          INSERT INTO organizations (name, slug, join_code) VALUES ('ASICME Global', 'asicme-global', 'GLOBAL');
        END IF;
      END $$;
    `);

    console.log("✅ Base de Datos inicializada correctamente.");
    client.release();
  } catch (err) {
    console.error(
      "❌ Error fatal al conectar con la Base de Datos:",
      err.message,
    );
  }
};
