import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const migrateSQL = `
DO $$ 
BEGIN 
    -- 1. Table: meetings (host_id)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'meetings_host_id_fkey') THEN
        ALTER TABLE meetings DROP CONSTRAINT meetings_host_id_fkey;
    END IF;
    ALTER TABLE meetings ADD CONSTRAINT meetings_host_id_fkey FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE;

    -- 2. Table: participants (user_id)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'participants_user_id_fkey') THEN
        ALTER TABLE participants DROP CONSTRAINT participants_user_id_fkey;
    END IF;
    ALTER TABLE participants ADD CONSTRAINT participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    -- 3. Table: participants (meeting_id)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'participants_meeting_id_fkey') THEN
        ALTER TABLE participants DROP CONSTRAINT participants_meeting_id_fkey;
    END IF;
    ALTER TABLE participants ADD CONSTRAINT participants_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;

    -- 4. Table: meeting_files (meeting_id)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'meeting_files_meeting_id_fkey') THEN
        ALTER TABLE meeting_files DROP CONSTRAINT meeting_files_meeting_id_fkey;
    END IF;
    ALTER TABLE meeting_files ADD CONSTRAINT meeting_files_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;

END $$;
`;

async function migrate() {
  try {
    console.log("🚀 Starting DB migration for cascading deletes...");
    await pool.query(migrateSQL);
    console.log(
      "✅ Migration successful: Foreign keys updated to ON DELETE CASCADE.",
    );
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
