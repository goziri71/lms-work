import { connectDB } from "../src/database/database.js";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to add enhanced course creation fields
 * 
 * New fields:
 * - description (TEXT) - Course description
 * - pricing_type (VARCHAR) - 'one_time' or 'free'
 * - course_outline (TEXT) - Course benefits/outline
 * - duration_days (INTEGER) - Course duration in days
 * - image_url (TEXT) - Course cover image URL
 * - category (VARCHAR) - Course category
 * - enrollment_limit (INTEGER) - Max enrollments (marketplace only)
 * - access_duration_days (INTEGER) - Access duration in days (marketplace only)
 * 
 * Run with: node scripts/migrate-add-course-enhancement-fields.js
 */

async function migrateAddCourseEnhancementFields() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("📦 Starting migration: Add course enhancement fields\n");

    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    const columnsToAdd = [
      {
        name: "description",
        type: "TEXT",
        nullable: true,
        comment: "Course description/overview",
      },
      {
        name: "pricing_type",
        type: dialect === 'postgres' 
          ? "VARCHAR(20) DEFAULT 'one_time' CHECK (pricing_type IN ('one_time', 'free'))"
          : "VARCHAR(20) DEFAULT 'one_time'",
        nullable: false,
        comment: "Pricing type: one_time or free",
      },
      {
        name: "course_outline",
        type: "TEXT",
        nullable: true,
        comment: "Course benefits/outline",
      },
      {
        name: "duration_days",
        type: "INTEGER",
        nullable: true,
        comment: "Course duration in days",
      },
      {
        name: "image_url",
        type: "TEXT",
        nullable: true,
        comment: "Course cover image URL",
      },
      {
        name: "category",
        type: dialect === 'postgres'
          ? "VARCHAR(50) CHECK (category IN ('Business', 'Tech', 'Art', 'Logistics', 'Ebooks', 'Podcast', 'Videos', 'Music', 'Articles', 'Code', '2D/3D Files'))"
          : "VARCHAR(50)",
        nullable: true,
        comment: "Course category",
      },
      {
        name: "enrollment_limit",
        type: "INTEGER",
        nullable: true,
        comment: "Maximum number of enrollments (marketplace only)",
      },
      {
        name: "access_duration_days",
        type: "INTEGER",
        nullable: true,
        comment: "Access duration in days from enrollment date (marketplace only)",
      },
    ];

    // Check existing columns and add missing ones
    console.log("🔍 Checking existing columns...");
    for (const column of columnsToAdd) {
      const columnInfo = await db.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'courses' AND column_name = '${column.name}'`,
        { type: QueryTypes.SELECT }
      );

      if (columnInfo && columnInfo.length > 0) {
        console.log(`   ✅ Column '${column.name}' already exists. Skipping.`);
        continue;
      }

      console.log(`   🔄 Adding column '${column.name}'...`);

      try {
        if (dialect === 'postgres') {
          await db.query(`
            ALTER TABLE courses
            ADD COLUMN ${column.name} ${column.type}
          `);
        } else if (dialect === 'mysql' || dialect === 'mariadb') {
          // MySQL doesn't support CHECK constraints in older versions
          const mysqlType = column.type.includes('CHECK') 
            ? column.type.split(' CHECK')[0] 
            : column.type;
          await db.query(`
            ALTER TABLE courses
            ADD COLUMN ${column.name} ${mysqlType}
          `);
        } else {
          console.error(`❌ Unsupported database dialect: ${dialect}`);
          process.exit(1);
        }

        console.log(`   ✅ Column '${column.name}' added successfully`);
      } catch (error) {
        console.error(`   ❌ Error adding column '${column.name}':`, error.message);
        throw error;
      }
    }

    // Set default pricing_type for existing courses based on price
    console.log("\n🔄 Setting default pricing_type for existing courses...");
    try {
      if (dialect === 'postgres') {
        await db.query(`
          UPDATE courses
          SET pricing_type = CASE
            WHEN price IS NULL OR price = '0' OR price = '' THEN 'free'
            ELSE 'one_time'
          END
          WHERE pricing_type IS NULL
        `);
      } else if (dialect === 'mysql' || dialect === 'mariadb') {
        await db.query(`
          UPDATE courses
          SET pricing_type = CASE
            WHEN price IS NULL OR price = '0' OR price = '' THEN 'free'
            ELSE 'one_time'
          END
          WHERE pricing_type IS NULL
        `);
      }
      console.log("   ✅ Default pricing_type set for existing courses");
    } catch (error) {
      console.warn("   ⚠️  Could not set default pricing_type:", error.message);
    }

    // Create indexes for better query performance
    console.log("\n🔄 Creating indexes...");
    const indexes = [
      { name: "idx_courses_category", column: "category" },
      { name: "idx_courses_enrollment_limit", column: "enrollment_limit" },
    ];

    for (const index of indexes) {
      try {
        if (dialect === 'postgres') {
          await db.query(`
            CREATE INDEX IF NOT EXISTS ${index.name}
            ON courses(${index.column})
            WHERE ${index.column} IS NOT NULL
          `);
        } else if (dialect === 'mysql' || dialect === 'mariadb') {
          await db.query(`
            CREATE INDEX ${index.name}
            ON courses(${index.column})
          `);
        }
        console.log(`   ✅ Index '${index.name}' created`);
      } catch (error) {
        if (error.message.includes("already exists") || error.message.includes("Duplicate key")) {
          console.log(`   ⚠️  Index '${index.name}' already exists. Skipping.`);
        } else {
          console.warn(`   ⚠️  Could not create index '${index.name}':`, error.message);
        }
      }
    }

    // Verify all columns
    console.log("\n🔄 Verifying columns...");
    const verifyColumns = await db.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'courses'
         AND column_name IN ('description', 'pricing_type', 'course_outline', 'duration_days', 'image_url', 'category', 'enrollment_limit', 'access_duration_days')
       ORDER BY column_name`,
      { type: QueryTypes.SELECT }
    );

    if (verifyColumns && verifyColumns.length > 0) {
      console.log(`\n✅ Verification: ${verifyColumns.length} columns added:`);
      verifyColumns.forEach((col) => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    console.log("\n==================================================");
    console.log("✅ MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================");
    console.log("\n📝 Next steps:");
    console.log("   1. All new columns have been added to courses table");
    console.log("   2. Update the Courses model to include new fields");
    console.log("   3. Update course creation/update endpoints");
    console.log("   4. Add enrollment limit and access duration checks\n");

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

migrateAddCourseEnhancementFields();

