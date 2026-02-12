import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    console.log('🚀 Añadiendo columna meeting_id a notifications (si no existe)...');
    await pool.query(`
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE;
    `);
    console.log('✅ Columna meeting_id asegurada en notifications.');
  } catch (err) {
    console.error('❌ Error al aplicar migración:', err.message || err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

migrate();
