import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function setupChatTable() {
  try {
    console.log("🔄 Conectando a la base de datos...");

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, "create_chat_table.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("📝 Ejecutando script SQL...");
    await pool.query(sql);

    console.log("✅ Tabla chat_messages creada exitosamente");
    console.log("✅ Índices creados para optimización");

    // Verificar la tabla
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'chat_messages'
      ORDER BY ordinal_position;
    `);

    console.log("\n📊 Estructura de la tabla:");
    console.table(result.rows);

    // Contar mensajes existentes (debería ser 0)
    const count = await pool.query("SELECT COUNT(*) FROM chat_messages");
    console.log(`\n💬 Mensajes actuales: ${count.rows[0].count}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error al crear la tabla:", err);
    process.exit(1);
  }
}

setupChatTable();
