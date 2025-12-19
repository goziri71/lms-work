import { connectDB } from "../src/database/database.js";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to change all URL columns from VARCHAR(500) to TEXT
 * Supabase signed URLs can be longer than 500 characters
 * 
 * Run with: node scripts/migrate-url-columns-to-text.js
 */

async function migrateUrlColumnsToText() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("📦 Starting migration: Change URL columns to TEXT\n");

    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    // Columns to update in students table
    const studentUrlColumns = [
      "profile_image",
      "birth_certificate",
      "ref_letter",
      "valid_id",
      "resume_cv",
      "certificate_file",
      "other_file",
    ];

    // Update students table columns
    console.log("🔄 Updating students table columns...");
    for (const colName of studentUrlColumns) {
      const columnInfo = await db.query(
        `SELECT column_name, data_type, character_maximum_length
         FROM information_schema.columns
         WHERE table_name = 'students' AND column_name = '${colName}'`,
        { type: QueryTypes.SELECT }
      );

      if (!columnInfo || columnInfo.length === 0) {
        console.log(`   ⚠️  Column '${colName}' does not exist. Skipping.`);
        continue;
      }

      const currentType = columnInfo[0].data_type;
      if (currentType === 'text') {
        console.log(`   ✅ Column '${colName}' is already TEXT. Skipping.`);
        continue;
      }

      console.log(`   🔄 Altering '${colName}' from ${currentType} to TEXT...`);
      
      if (dialect === 'postgres') {
        await db.query(`
          ALTER TABLE students
          ALTER COLUMN ${colName} TYPE TEXT
        `);
      } else if (dialect === 'mysql' || dialect === 'mariadb') {
        await db.query(`
          ALTER TABLE students
          MODIFY COLUMN ${colName} TEXT
        `);
      }
      
      console.log(`   ✅ Column '${colName}' updated to TEXT`);
    }

    // Update student_document_approvals table
    console.log("\n🔄 Updating student_document_approvals table...");
    const approvalColumnInfo = await db.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'student_document_approvals' AND column_name = 'file_url'`,
      { type: QueryTypes.SELECT }
    );

    if (approvalColumnInfo && approvalColumnInfo.length > 0) {
      const currentType = approvalColumnInfo[0].data_type;
      if (currentType === 'text') {
        console.log(`   ✅ Column 'file_url' is already TEXT. Skipping.`);
      } else {
        console.log(`   🔄 Altering 'file_url' from ${currentType} to TEXT...`);
        
        if (dialect === 'postgres') {
          await db.query(`
            ALTER TABLE student_document_approvals
            ALTER COLUMN file_url TYPE TEXT
          `);
        } else if (dialect === 'mysql' || dialect === 'mariadb') {
          await db.query(`
            ALTER TABLE student_document_approvals
            MODIFY COLUMN file_url TEXT
          `);
        }
        
        console.log(`   ✅ Column 'file_url' updated to TEXT`);
      }
    } else {
      console.log(`   ⚠️  Column 'file_url' does not exist in student_document_approvals.`);
    }

    // Verify changes
    console.log("\n🔄 Verifying changes...");
    const verifyColumns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'students'
        AND column_name IN ('profile_image', 'birth_certificate', 'ref_letter', 'valid_id', 'resume_cv', 'certificate_file', 'other_file')
      ORDER BY column_name
    `, { type: QueryTypes.SELECT });

    console.log("\n✅ Students table URL columns:");
    verifyColumns.forEach((col) => {
      const status = col.data_type === 'text' ? '✅' : '⚠️';
      console.log(`   ${status} ${col.column_name}: ${col.data_type}`);
    });

    const verifyApproval = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'student_document_approvals' AND column_name = 'file_url'
    `, { type: QueryTypes.SELECT });

    if (verifyApproval && verifyApproval.length > 0) {
      console.log("\n✅ student_document_approvals table:");
      const status = verifyApproval[0].data_type === 'text' ? '✅' : '⚠️';
      console.log(`   ${status} ${verifyApproval[0].column_name}: ${verifyApproval[0].data_type}`);
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
migrateUrlColumnsToText();

