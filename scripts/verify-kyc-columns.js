import { connectDB } from "../src/database/database.js";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Verification script to check all KYC-related column sizes
 */

async function verifyKycColumns() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("🔍 Verifying KYC column sizes...\n");

    const dialect = db.getDialect();
    
    // Check students table columns
    console.log("📋 Students table columns:");
    const studentColumns = await db.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'students'
        AND column_name IN (
          'profile_image',
          'birth_certificate',
          'ref_letter',
          'valid_id',
          'resume_cv',
          'certificate_file',
          'other_file',
          'school',
          'school1',
          'school2'
        )
      ORDER BY column_name
    `, { type: QueryTypes.SELECT });

    studentColumns.forEach((col) => {
      const length = col.character_maximum_length || 'unlimited';
      const status = col.character_maximum_length && col.character_maximum_length >= 500 ? '✅' : '⚠️';
      console.log(`   ${status} ${col.column_name}: ${col.data_type}(${length})`);
    });

    // Check student_document_approvals table
    console.log("\n📋 student_document_approvals table columns:");
    const approvalColumns = await db.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'student_document_approvals'
        AND column_name = 'file_url'
    `, { type: QueryTypes.SELECT });

    approvalColumns.forEach((col) => {
      const length = col.character_maximum_length || 'unlimited';
      const status = col.character_maximum_length && col.character_maximum_length >= 500 ? '✅' : '⚠️';
      console.log(`   ${status} ${col.column_name}: ${col.data_type}(${length})`);
    });

    console.log("\n✅ Verification complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Verification failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyKycColumns();

