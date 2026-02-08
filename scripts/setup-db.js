import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configurar dotenv para leer el archivo .env desde la raíz
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function setupDatabase() {
  try {
    console.log('🔌 Conectando a la base de datos Neon...');

    // Crear tabla de usuarios
    console.log('🚧 Creando tabla de usuarios...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'participant'
      );
    `);

    // Crear tabla de reuniones
    console.log('🚧 Creando tabla de reuniones...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        host_id INT REFERENCES users(id),
        link TEXT UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Crear tabla de participantes
    console.log('🚧 Creando tabla de participantes...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        meeting_id INT REFERENCES meetings(id),
        user_id INT REFERENCES users(id),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Tablas creadas exitosamente.');

    // Verificar si ya existen usuarios
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', ['alexis@example.com']);
    
    if (userCheck.rows.length === 0) {
      console.log('👤 Insertando usuario de prueba...');
      await pool.query("INSERT INTO users (name, email) VALUES ('Alexis', 'alexis@example.com')");
      console.log('✅ Usuario de prueba insertado.');
    } else {
      console.log('ℹ️ El usuario de prueba ya existe.');
    }

    // Probar consulta básica
    console.log('🔍 Verificando datos en la tabla users:');
    const res = await pool.query('SELECT * FROM users');
    console.table(res.rows);

  } catch (err) {
    console.error('❌ Error configurando la base de datos:', err);
  } finally {
    await pool.end();
    console.log('👋 Conexión cerrada.');
  }
}

setupDatabase();
