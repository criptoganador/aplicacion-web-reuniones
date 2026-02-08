import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkStructure() {
  try {
    console.log('🔍 Verificando estructura exacta de las tablas...\n');

    const tables = ['users', 'meetings', 'participants'];

    for (const table of tables) {
      console.log(`📋 Tabla: ${table.toUpperCase()}`);
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [table]);

      if (res.rows.length === 0) {
        console.log('   ❌ No encontrada');
      } else {
        res.rows.forEach(col => {
          console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });
      }
      console.log('');
    }

    console.log('👤 Datos de prueba en Users:');
    const user = await pool.query("SELECT * FROM users");
    console.table(user.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkStructure();
