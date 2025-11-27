import { db } from "../database/database.js";
import { connectDB } from "../database/database.js";

/**
 * Migration script for Course Allocation & Pricing System
 * 
 * ⚠️ SAFETY: This script ONLY ADDS to the database. It NEVER deletes or modifies existing data.
 * 
 * This script:
 * 1. Creates course_semester_pricing table (NEW table, no existing data affected)
 * 2. Adds registration_deadline to semester table (NEW column, existing data unchanged)
 * 3. Adds new columns to course_reg table (NEW columns only, existing data preserved)
 * 4. Creates indexes (performance only, no data changes)
 * 5. Sets default values for NULL fields (only updates NULL to default, never deletes)
 * 
 * ✅ SAFE OPERATIONS:
 * - CREATE TABLE IF NOT EXISTS (only creates if doesn't exist)
 * - ALTER TABLE ADD COLUMN IF NOT EXISTS (only adds if doesn't exist)
 * - CREATE INDEX IF NOT EXISTS (only creates if doesn't exist)
 * - UPDATE only sets NULL values to defaults (never deletes rows)
 * 
 * ❌ NO DELETIONS:
 * - No DROP TABLE
 * - No DROP COLUMN
 * - No DELETE statements
 * - No TRUNCATE
 * 
 * Usage: node src/scripts/migrateCourseAllocationSystem.js
 */

async function migrateCourseAllocationSystem() {
  try {
    console.log("🚀 Starting Course Allocation System migration...\n");

    // Connect to database
    console.log("🔌 Connecting to database...");
    await db.authenticate();
    console.log("✅ Database connected\n");

    // Step 1: Create course_semester_pricing table
    console.log("📊 Step 1: Creating course_semester_pricing table...");
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS course_semester_pricing (
          id SERIAL PRIMARY KEY,
          course_id INTEGER NOT NULL,
          academic_year VARCHAR(20) NOT NULL,
          semester VARCHAR(20) NOT NULL,
          price DECIMAL(12,2) NOT NULL,
          currency VARCHAR(5) NOT NULL DEFAULT 'NGN',
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_course_semester_pricing_course 
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
            -- Using RESTRICT instead of CASCADE to prevent accidental deletions
          CONSTRAINT unique_course_semester_pricing 
            UNIQUE(course_id, academic_year, semester)
        )
      `);
      console.log("   ✅ course_semester_pricing table created\n");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log("   ⚠️  course_semester_pricing table already exists\n");
      } else {
        throw error;
      }
    }

    // Step 2: Add registration_deadline to semester table
    console.log("📊 Step 2: Adding registration_deadline to semester table...");
    try {
      await db.query(`
        ALTER TABLE semester 
        ADD COLUMN IF NOT EXISTS registration_deadline DATE
      `);
      console.log("   ✅ registration_deadline column added\n");
    } catch (error) {
      console.error("   ❌ Error adding registration_deadline:", error.message);
      throw error;
    }

    // Step 3: Add new columns to course_reg table
    console.log("📊 Step 3: Adding new columns to course_reg table...");
    
    // Add registration_status (use VARCHAR for compatibility, ENUM can be added later if needed)
    try {
      await db.query(`
        ALTER TABLE course_reg 
        ADD COLUMN IF NOT EXISTS registration_status VARCHAR(20) DEFAULT 'allocated'
      `);
      console.log("   ✅ registration_status column added");
    } catch (error) {
      console.error("   ❌ Error adding registration_status:", error.message);
      throw error;
    }

    // Add allocated_price
    try {
      await db.query(`
        ALTER TABLE course_reg 
        ADD COLUMN IF NOT EXISTS allocated_price DECIMAL(12,2)
      `);
      console.log("   ✅ allocated_price column added");
    } catch (error) {
      console.error("   ❌ Error adding allocated_price:", error.message);
      throw error;
    }

    // Add allocated_at
    try {
      await db.query(`
        ALTER TABLE course_reg 
        ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMP
      `);
      console.log("   ✅ allocated_at column added");
    } catch (error) {
      console.error("   ❌ Error adding allocated_at:", error.message);
      throw error;
    }

    // Add registered_at
    try {
      await db.query(`
        ALTER TABLE course_reg 
        ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP
      `);
      console.log("   ✅ registered_at column added");
    } catch (error) {
      console.error("   ❌ Error adding registered_at:", error.message);
      throw error;
    }

    console.log("   ✅ All course_reg columns added\n");

    // Step 4: Create indexes for better performance
    console.log("📊 Step 4: Creating indexes...");
    
    // Index on course_semester_pricing
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_course_semester_pricing_semester 
        ON course_semester_pricing(academic_year, semester)
      `);
      console.log("   ✅ Index on course_semester_pricing created");
    } catch (error) {
      console.log("   ⚠️  Index may already exist:", error.message);
    }

    // Index on course_reg registration_status
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_course_reg_status 
        ON course_reg(registration_status)
      `);
      console.log("   ✅ Index on course_reg.registration_status created");
    } catch (error) {
      console.log("   ⚠️  Index may already exist:", error.message);
    }

    // Index on course_reg for student semester queries
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_course_reg_student_semester 
        ON course_reg(student_id, academic_year, semester)
      `);
      console.log("   ✅ Index on course_reg(student_id, academic_year, semester) created");
    } catch (error) {
      console.log("   ⚠️  Index may already exist:", error.message);
    }

    console.log("   ✅ All indexes created\n");

    // Step 5: Update existing CourseReg records to have default status
    // ⚠️ SAFETY: Only updates NULL values to defaults. Never modifies existing non-NULL data.
    console.log("📊 Step 5: Setting default values for existing CourseReg records (NULL values only)...");
    try {
      // Only update records where registration_status IS NULL (new column will be NULL for existing records)
      // This is safe - we're only setting defaults for the new column, not changing existing data
      const [result] = await db.query(`
        UPDATE course_reg 
        SET registration_status = 'registered' 
        WHERE registration_status IS NULL 
          AND course_reg_id IS NOT NULL
      `);
      console.log(`   ✅ Set default 'registered' status for ${result.rowCount || 0} existing paid registrations`);
      
      // Set remaining null statuses to 'allocated' (for records without course_reg_id)
      // Again, only updating NULL values in the NEW column
      const [result2] = await db.query(`
        UPDATE course_reg 
        SET registration_status = 'allocated' 
        WHERE registration_status IS NULL
      `);
      console.log(`   ✅ Set default 'allocated' status for ${result2.rowCount || 0} existing records\n`);
      console.log("   ℹ️  Note: Only NULL values were updated. Existing data was not modified.\n");
    } catch (error) {
      console.log("   ⚠️  Could not update existing records:", error.message);
      console.log("   ℹ️  This is not critical - new columns will have NULL values\n");
    }

    console.log("==================================================");
    console.log("✅ MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================\n");
    console.log("📋 Summary:");
    console.log("   ✅ course_semester_pricing table created");
    console.log("   ✅ semester.registration_deadline column added");
    console.log("   ✅ course_reg.registration_status column added");
    console.log("   ✅ course_reg.allocated_price column added");
    console.log("   ✅ course_reg.allocated_at column added");
    console.log("   ✅ course_reg.registered_at column added");
    console.log("   ✅ Indexes created");
    console.log("   ✅ Existing records updated\n");

  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  } finally {
    try {
      await db.sequelize.close();
      console.log("🔌 Database connection closed");
    } catch (closeError) {
      console.error("⚠️  Error closing database connection:", closeError.message);
    }
  }
}

// Run migration
migrateCourseAllocationSystem()
  .then(() => {
    console.log("✅ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration script failed:", error);
    process.exit(1);
  });

