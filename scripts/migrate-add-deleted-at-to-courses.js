import { connectDB } from "../src/database/database.js";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to add deleted_at column to courses table
 * This enables industry-standard soft deletes using timestamp
 * 
 * Run with: node scripts/migrate-add-deleted-at-to-courses.js
 */

async function migrateAddDeletedAtToCourses() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("📦 Starting migration: Add deleted_at to courses table\n");

    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    // Check if column already exists
    console.log("🔍 Checking if deleted_at column exists...");
    const columnInfo = await db.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'courses' AND column_name = 'deleted_at'`,
      { type: QueryTypes.SELECT }
    );

    if (columnInfo && columnInfo.length > 0) {
      console.log("✅ Column 'deleted_at' already exists. Migration not needed.");
      process.exit(0);
    }

    // Add deleted_at column
    console.log("🔄 Adding 'deleted_at' column to courses table...");
    
    if (dialect === 'postgres') {
      await db.query(`
        ALTER TABLE courses
        ADD COLUMN deleted_at TIMESTAMP NULL
      `);
    } else if (dialect === 'mysql' || dialect === 'mariadb') {
      await db.query(`
        ALTER TABLE courses
        ADD COLUMN deleted_at TIMESTAMP NULL
      `);
    } else {
      console.error(`❌ Unsupported database dialect: ${dialect}`);
      console.error("Please manually add the deleted_at column to the courses table");
      process.exit(1);
    }
    
    console.log("✅ Column 'deleted_at' added successfully");

    // Create index on deleted_at for better query performance
    console.log("\n🔄 Creating index on deleted_at...");
    try {
      if (dialect === 'postgres') {
        await db.query(`
          CREATE INDEX IF NOT EXISTS idx_courses_deleted_at 
          ON courses(deleted_at)
        `);
      } else if (dialect === 'mysql' || dialect === 'mariadb') {
        await db.query(`
          CREATE INDEX idx_courses_deleted_at 
          ON courses(deleted_at)
        `);
      }
      console.log("✅ Index created successfully");
    } catch (indexError) {
      if (indexError.message.includes("already exists") || indexError.message.includes("Duplicate key")) {
        console.log("⚠️  Index already exists. Skipping.");
      } else {
        console.warn("⚠️  Could not create index (non-critical):", indexError.message);
      }
    }

    // Verify the change
    console.log("\n🔄 Verifying the change...");
    const verifyColumn = await db.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'courses' AND column_name = 'deleted_at'`,
      { type: QueryTypes.SELECT }
    );

    if (verifyColumn && verifyColumn.length > 0) {
      const col = verifyColumn[0];
      console.log(`✅ Verification: Column 'deleted_at' is now ${col.data_type} (nullable: ${col.is_nullable})`);
    }

    console.log("\n==================================================");
    console.log("✅ MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================");
    console.log("\n📝 Next steps:");
    console.log("   1. The deleted_at column has been added to courses table");
    console.log("   2. Update the Courses model to use paranoid: true");
    console.log("   3. Update delete functions to use proper soft delete");
    console.log("   4. All course queries will now automatically exclude deleted courses\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    if (error.original) {
      console.error("   Original error:", error.original.message);
    }
    console.error("\nFull error:", error);
    process.exit(1);
  }
}

migrateAddDeletedAtToCourses();

