import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function validateDatabase() {
  try {
    console.log('🔍 Iniciando validación completa de la base de datos...\n');

    // 1. Validar existencia de tablas
    const tables = ['users', 'meetings', 'participants'];
    for (const table of tables) {
      const res = await pool.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
        [table]
      );
      if (res.rows[0].exists) {
        console.log(`✅ Tabla '${table}' existe.`);
      } else {
        console.error(`❌ ERROR: Tabla '${table}' NO existe.`);
      }
    }

    console.log('\n📊 Verificando estructura de columnas...');

    // 2. Validar estructura de tabla Users
    const usersCols = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'"
    );
    console.log('📋 Columnas en Users:', usersCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
    
    // 3. Validar datos de prueba
    console.log('\n👤 Verificando datos de prueba...');
    const userRes = await pool.query("SELECT * FROM users WHERE email = 'alexis@example.com'");
    if (userRes.rows.length > 0) {
      console.log('✅ Usuario de prueba encontrado:', userRes.rows[0]);
    } else {
      console.warn('⚠️ Usuario de prueba NO encontrado.');
    }

    console.log('\n🎉 Validación finalizada.');

  } catch (err) {
    console.error('❌ Error durante la validación:', err);
  } finally {
    await pool.end();
  }
}

validateDatabase();
