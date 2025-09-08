import { dbLibrary } from "../database/database.js";

async function migrateLibrary() {
  try {
    console.log("🔧 Starting Library DB migration (modules, units)...");

    // Create modules table
    await dbLibrary.query(`
      CREATE TABLE IF NOT EXISTS modules (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description VARCHAR(1000) NOT NULL,
        course_id INTEGER NOT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        status VARCHAR(50) NOT NULL,
        created_by INTEGER NOT NULL,
        updated_by INTEGER NOT NULL
      );
    `);
    console.log("✅ Ensured table: modules");

    // Create units table with FK to modules and ON DELETE CASCADE
    await dbLibrary.query(`
      CREATE TABLE IF NOT EXISTS units (
        id SERIAL PRIMARY KEY,
        module_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NULL,
        content_type VARCHAR(20) NOT NULL DEFAULT 'html',
        "order" INTEGER NOT NULL DEFAULT 1,
        duration_min INTEGER NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        status VARCHAR(50) NULL,
        created_by INTEGER NULL,
        updated_by INTEGER NULL,
        CONSTRAINT fk_units_module
          FOREIGN KEY (module_id)
          REFERENCES modules(id)
          ON DELETE CASCADE
      );
    `);
    console.log("✅ Ensured table: units (with FK ON DELETE CASCADE)");

    // Add video fields to units if not present
    await dbLibrary.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='units' AND column_name='video_url'
        ) THEN
          ALTER TABLE units ADD COLUMN video_url VARCHAR(1000) NULL;
        END IF;
      END $$;
    `);
    await dbLibrary.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='units' AND column_name='video_duration_sec'
        ) THEN
          ALTER TABLE units ADD COLUMN video_duration_sec INTEGER NULL;
        END IF;
      END $$;
    `);
    console.log("✅ Ensured columns on units: video_url, video_duration_sec");

    // Create unit_notes table (one note per student per unit)
    await dbLibrary.query(`
      CREATE TABLE IF NOT EXISTS unit_notes (
        id SERIAL PRIMARY KEY,
        unit_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        note_text TEXT NOT NULL,
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_unit_notes_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
        CONSTRAINT uq_unit_notes UNIQUE (unit_id, student_id)
      );
    `);
    console.log("✅ Ensured table: unit_notes");

    // Create discussions and discussion_messages tables
    await dbLibrary.query(`
      CREATE TABLE IF NOT EXISTS discussions (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL,
        academic_year VARCHAR(20) NOT NULL,
        semester VARCHAR(20) NOT NULL,
        created_by_staff_id INTEGER NOT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    await dbLibrary.query(`
      CREATE TABLE IF NOT EXISTS discussion_messages (
        id SERIAL PRIMARY KEY,
        discussion_id INTEGER NOT NULL,
        sender_type VARCHAR(10) NOT NULL,
        sender_id INTEGER NOT NULL,
        message_text TEXT NOT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_discussion_messages_discussion FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE
      );
    `);
    console.log("✅ Ensured tables: discussions, discussion_messages");

    // Optional helpful indexes
    await dbLibrary.query(
      `CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);`
    );
    await dbLibrary.query(
      `CREATE INDEX IF NOT EXISTS idx_units_module_id ON units(module_id);`
    );

    console.log("🎉 Library migration completed.");
  } catch (err) {
    console.error("❌ Migration error:", err);
  } finally {
    await dbLibrary.close();
    process.exit(0);
  }
}

migrateLibrary();
