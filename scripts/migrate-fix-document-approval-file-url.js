import { connectDB } from "../src/database/database.js";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to fix file_url column in student_document_approvals table
 * Alters file_url from VARCHAR(255) to VARCHAR(500) to support long Supabase URLs
 * 
 * Run with: node scripts/migrate-fix-document-approval-file-url.js
 */

async function migrateFixFileUrl() {
  try {
    // Connect to database
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("📦 Starting migration: Fix file_url column in student_document_approvals table\n");

    // Get database dialect
    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    // Check if table exists
    let tableExists;
    if (dialect === 'postgres') {
      const result = await db.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_document_approvals') as exists`,
        { type: QueryTypes.SELECT }
      );
      tableExists = result[0]?.exists;
    } else {
      const result = await db.query(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'student_document_approvals'`,
        { type: QueryTypes.SELECT }
      );
      tableExists = result[0]?.count > 0;
    }

    if (!tableExists) {
      console.log("⚠️  Table student_document_approvals does not exist. Run migrate-student-document-approvals.js first.");
      process.exit(0);
    }

    // Check current column type
    const columnInfo = await db.query(
      `SELECT column_name, character_maximum_length, data_type
       FROM information_schema.columns
       WHERE table_name = 'student_document_approvals' AND column_name = 'file_url'`,
      { type: QueryTypes.SELECT }
    );

    if (!columnInfo || columnInfo.length === 0) {
      console.log("⚠️  Column file_url does not exist in student_document_approvals table.");
      process.exit(0);
    }

    const maxLength = columnInfo[0].character_maximum_length;
    console.log(`Current file_url column type: ${columnInfo[0].data_type}(${maxLength || 'unlimited'})\n`);

    if (maxLength && maxLength >= 500) {
      console.log("✅ Column file_url already has sufficient length. Migration not needed.");
      process.exit(0);
    }

    // Alter column to VARCHAR(500)
    console.log(`🔄 Altering file_url column from VARCHAR(${maxLength || 255}) to VARCHAR(500)...`);
    
    if (dialect === 'postgres') {
      await db.query(`
        ALTER TABLE student_document_approvals
        ALTER COLUMN file_url TYPE VARCHAR(500)
      `);
    } else if (dialect === 'mysql' || dialect === 'mariadb') {
      await db.query(`
        ALTER TABLE student_document_approvals
        MODIFY COLUMN file_url VARCHAR(500)
      `);
    } else {
      console.error(`❌ Unsupported database dialect: ${dialect}`);
      process.exit(1);
    }

    console.log("✅ Column file_url updated to VARCHAR(500)");

    // Verify the change
    const verifyColumn = await db.query(
      `SELECT column_name, character_maximum_length, data_type
       FROM information_schema.columns
       WHERE table_name = 'student_document_approvals' AND column_name = 'file_url'`,
      { type: QueryTypes.SELECT }
    );

    if (verifyColumn && verifyColumn.length > 0) {
      console.log(`\n✅ Verification: file_url is now ${verifyColumn[0].data_type}(${verifyColumn[0].character_maximum_length})`);
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
migrateFixFileUrl();

