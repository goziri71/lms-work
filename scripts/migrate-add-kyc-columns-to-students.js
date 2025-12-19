import { connectDB } from "../src/database/database.js";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to add KYC columns to students table
 * Adds: profile_image column
 * 
 * Note: Other document columns (birth_certificate, ref_letter, etc.) should already exist
 * 
 * Run with: node scripts/migrate-add-kyc-columns-to-students.js
 */

async function migrateAddKycColumns() {
  try {
    // Connect to database
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("📦 Starting migration: Add KYC columns to students table\n");

    // Get database dialect
    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    // Columns to add (check if they exist first)
    const columnsToAdd = [
      {
        name: "profile_image",
        type: dialect === 'postgres' ? "VARCHAR(500)" : "VARCHAR(500)",
        nullable: true,
        comment: "Profile picture URL from Supabase",
      },
    ];

    // Also check existing document columns (they should exist but verify)
    const existingColumns = [
      "birth_certificate",
      "ref_letter",
      "valid_id",
      "resume_cv",
      "certificate_file",
      "other_file",
    ];

    if (dialect === 'postgres') {
      // Check existing columns
      for (const column of columnsToAdd) {
        const columnInfo = await db.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'students'
            AND column_name = $1
        `, {
          type: QueryTypes.SELECT,
          replacements: [column.name],
        });

        if (columnInfo && columnInfo.length > 0) {
          console.log(`✅ Column '${column.name}' already exists. Skipping.`);
          continue;
        }

        // Add column
        console.log(`🔄 Adding column '${column.name}'...`);
        const nullable = column.nullable ? "" : "NOT NULL";
        await db.query(`
          ALTER TABLE students
          ADD COLUMN ${column.name} ${column.type} ${nullable}
        `);
        console.log(`✅ Column '${column.name}' added successfully`);
      }

    } else if (dialect === 'mysql' || dialect === 'mariadb') {
      // Check existing columns
      for (const column of columnsToAdd) {
        const columnInfo = await db.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'students'
            AND column_name = ?
        `, {
          type: QueryTypes.SELECT,
          replacements: [column.name],
        });

        if (columnInfo && columnInfo.length > 0) {
          console.log(`✅ Column '${column.name}' already exists. Skipping.`);
          continue;
        }

        // Add column
        console.log(`🔄 Adding column '${column.name}'...`);
        const nullable = column.nullable ? "NULL" : "NOT NULL";
        await db.query(`
          ALTER TABLE students
          ADD COLUMN ${column.name} ${column.type} ${nullable}
        `);
        console.log(`✅ Column '${column.name}' added successfully`);
      }
    } else {
      console.error(`❌ Unsupported database dialect: ${dialect}`);
      process.exit(1);
    }

    // Check existing document columns
    console.log("\n🔄 Checking existing document columns...");
    for (const colName of existingColumns) {
      const colInfo = await db.query(
        dialect === 'postgres'
          ? `SELECT column_name FROM information_schema.columns WHERE table_name = 'students' AND column_name = $1`
          : `SELECT column_name FROM information_schema.columns WHERE table_name = 'students' AND column_name = ?`,
        {
          type: QueryTypes.SELECT,
          replacements: [colName],
        }
      );

      if (colInfo && colInfo.length > 0) {
        console.log(`   ✅ ${colName} exists`);
      } else {
        console.log(`   ⚠️  ${colName} is missing - you may need to add it manually`);
      }
    }

    // Verify columns
    console.log("\n🔄 Verifying KYC columns...");
    const verifyColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'students'
        AND column_name IN ('profile_image', 'birth_certificate', 'ref_letter', 'valid_id', 'resume_cv', 'certificate_file', 'other_file')
      ORDER BY column_name
    `, { type: QueryTypes.SELECT });

    if (verifyColumns && verifyColumns.length > 0) {
      console.log("\n✅ Verification: KYC columns in students table:");
      verifyColumns.forEach((col) => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }

    console.log("\n==================================================");
    console.log("✅ MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrateAddKycColumns();

