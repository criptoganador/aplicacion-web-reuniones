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
        organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        host_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        link TEXT UNIQUE NOT NULL,
        meeting_type TEXT DEFAULT 'instant',
        title TEXT,
        scheduled_time TIMESTAMP,
        organized_by TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, meeting_id)
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS meeting_files (
        id SERIAL PRIMARY KEY,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        filename TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_organizations (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, organization_id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. ✨ MIGRACIONES DINÁMICAS (Para bases ya existentes)
    await client.query(`
      -- Asegurar organized_by
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='organized_by') THEN
          ALTER TABLE meetings ADD COLUMN organized_by TEXT;
        END IF;
      END $$;

      -- Asegurar meeting_type
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='meeting_type') THEN
          ALTER TABLE meetings ADD COLUMN meeting_type TEXT DEFAULT 'instant';
        END IF;
      END $$;

      -- Asegurar columnas en la tabla users
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='organization_id') THEN
          ALTER TABLE users ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_verified') THEN
          ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT TRUE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='verification_token') THEN
          ALTER TABLE users ADD COLUMN verification_token TEXT;
        END IF;
      END $$;

      -- Asegurar join_code en organizations
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='join_code') THEN
          ALTER TABLE organizations ADD COLUMN join_code TEXT UNIQUE;
        END IF;
      END $$;

      -- Asegurar description en organizations
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='description') THEN
          ALTER TABLE organizations ADD COLUMN description TEXT;
        END IF;
      END $$;

      -- Asegurar website en organizations
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='website') THEN
          ALTER TABLE organizations ADD COLUMN website TEXT;
        END IF;
      END $$;

      -- Asegurar website en organizations
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='website') THEN
          ALTER TABLE organizations ADD COLUMN website TEXT;
        END IF;
      END $$;

      -- Asegurar owner_id en organizations
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='owner_id') THEN
          ALTER TABLE organizations ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;

      -- Migración de datos a user_organizations
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_organizations') THEN
          INSERT INTO user_organizations (user_id, organization_id, role)
          SELECT id, organization_id, role FROM users
          WHERE organization_id IS NOT NULL
          ON CONFLICT DO NOTHING;
        END IF;
      END $$;

      -- Asegurar organización por defecto
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'asicme-global') THEN
          INSERT INTO organizations (name, slug, join_code) VALUES ('ASICME Global', 'asicme-global', 'GLOBAL');
        END IF;
      END $$;

      -- 💳 MIGRACIÓN SAAS / STRIPE
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='plan') THEN
          ALTER TABLE organizations ADD COLUMN plan TEXT DEFAULT 'free';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='stripe_customer_id') THEN
          ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='stripe_subscription_id') THEN
          ALTER TABLE organizations ADD COLUMN stripe_subscription_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='subscription_status') THEN
          ALTER TABLE organizations ADD COLUMN subscription_status TEXT DEFAULT 'active';
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
