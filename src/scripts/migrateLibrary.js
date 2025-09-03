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
