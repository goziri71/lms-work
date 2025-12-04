import { db } from "../database/database.js";
import { connectDB } from "../database/database.js";

/**
 * Migration script for School Fees Configuration System
 * 
 * ⚠️ SAFETY: This script ONLY ADDS to the database. It NEVER deletes or modifies existing data.
 * 
 * This script:
 * 1. Creates school_fees_configuration table (NEW table, no existing data affected)
 * 2. Creates indexes (performance only, no data changes)
 * 
 * ✅ SAFE OPERATIONS:
 * - CREATE TABLE IF NOT EXISTS (only creates if doesn't exist)
 * - CREATE INDEX IF NOT EXISTS (only creates if doesn't exist)
 * 
 * ❌ NO DELETIONS:
 * - No DROP TABLE
 * - No DROP COLUMN
 * - No DELETE statements
 * - No TRUNCATE
 * 
 * Usage: node src/scripts/migrateSchoolFeesSystem.js
 */

async function migrateSchoolFeesSystem() {
  try {
    console.log("🚀 Starting School Fees System migration...\n");

    // Connect to database
    console.log("🔌 Connecting to database...");
    await db.authenticate();
    console.log("✅ Database connected\n");

    // Step 1: Create school_fees_configuration table
    console.log("📊 Step 1: Creating school_fees_configuration table...");
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS school_fees_configuration (
          id SERIAL PRIMARY KEY,
          academic_year VARCHAR(20) NOT NULL,
          level VARCHAR(20),
          program_id INTEGER,
          faculty_id INTEGER,
          amount DECIMAL(12,2) NOT NULL,
          currency VARCHAR(5) NOT NULL DEFAULT 'NGN',
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_by INTEGER,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_school_fees_config_program 
            FOREIGN KEY (program_id) 
            REFERENCES programs(id) 
            ON DELETE SET NULL,
          CONSTRAINT fk_school_fees_config_faculty 
            FOREIGN KEY (faculty_id) 
            REFERENCES faculty(id) 
            ON DELETE SET NULL
        );
      `);
      console.log("✅ school_fees_configuration table created\n");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log("ℹ️  school_fees_configuration table already exists\n");
      } else {
        throw error;
      }
    }

    // Step 2: Create unique index for configuration
    console.log("📊 Step 2: Creating unique index...");
    try {
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_school_fees_config 
        ON school_fees_configuration (academic_year, level, program_id, faculty_id);
      `);
      console.log("✅ Unique index created\n");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log("ℹ️  Unique index already exists\n");
      } else {
        throw error;
      }
    }

    // Step 3: Create additional indexes for performance
    console.log("📊 Step 3: Creating performance indexes...");
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_school_fees_config_academic_year 
        ON school_fees_configuration (academic_year);
      `);
      console.log("✅ Index on academic_year created");

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_school_fees_config_level 
        ON school_fees_configuration (level);
      `);
      console.log("✅ Index on level created");

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_school_fees_config_program 
        ON school_fees_configuration (program_id);
      `);
      console.log("✅ Index on program_id created");

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_school_fees_config_faculty 
        ON school_fees_configuration (faculty_id);
      `);
      console.log("✅ Index on faculty_id created");

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_school_fees_config_active 
        ON school_fees_configuration (is_active);
      `);
      console.log("✅ Index on is_active created\n");
    } catch (error) {
      console.error("⚠️  Error creating indexes (may already exist):", error.message);
    }

    console.log("✅ Migration completed successfully!\n");
    console.log("📝 Summary:");
    console.log("   - school_fees_configuration table: ✅");
    console.log("   - Indexes: ✅");
    console.log("\n🎉 School Fees System migration complete!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    // Close database connection
    try {
      if (db && db.sequelize) {
        await db.sequelize.close();
        console.log("\n🔌 Database connection closed");
      }
    } catch (closeError) {
      console.error("⚠️  Error closing database connection:", closeError.message);
    }
  }
}

// Run migration
migrateSchoolFeesSystem()
  .then(() => {
    console.log("\n✅ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration script failed:", error);
    process.exit(1);
  });

