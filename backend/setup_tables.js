import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const sql = `
-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Reuniones
CREATE TABLE IF NOT EXISTS meetings (
    id SERIAL PRIMARY KEY,
    host_id INTEGER REFERENCES users(id),
    link VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    meeting_type VARCHAR(20) DEFAULT 'instant', -- instant, later, scheduled
    title VARCHAR(100),
    scheduled_time TIMESTAMP,
    organized_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Participantes (Quién entró a qué reunión)
CREATE TABLE IF NOT EXISTS participants (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id),
    user_id INTEGER REFERENCES users(id),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Mensajes de Chat
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id),
    sender_id INTEGER REFERENCES users(id),
    recipient_id INTEGER REFERENCES users(id), -- Para mensajes privados (NULL si es público)
    message TEXT NOT NULL,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP,
    deleted_at TIMESTAMP
);
`;

async function setup() {
  try {
    console.log("🚀 Iniciando creación de tablas en Neon...");
    await pool.query(sql);
    console.log("✅ Tablas creadas exitosamente.");
  } catch (err) {
    console.error("❌ Error creando tablas:", err);
  } finally {
    await pool.end();
  }
}

setup();
