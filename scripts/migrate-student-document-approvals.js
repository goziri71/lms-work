import { connectDB } from "../src/database/database.js";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to create student_document_approvals table
 * This table tracks approval status for student KYC documents
 * 
 * Run with: node scripts/migrate-student-document-approvals.js
 */

async function migrateStudentDocumentApprovals() {
  try {
    // Connect to database
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("📦 Starting migration: Create student_document_approvals table\n");

    // Check if table already exists
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'student_document_approvals'
      );
    `, { type: QueryTypes.SELECT });

    if (tableExists[0]?.exists) {
      console.log("✅ Table student_document_approvals already exists. Migration not needed.");
      process.exit(0);
    }

    // Get database dialect
    const dialect = db.getDialect();

    console.log(`Database dialect: ${dialect}\n`);

    if (dialect === 'postgres') {
      // PostgreSQL: Create table
      console.log("🔄 Creating student_document_approvals table...");
      await db.query(`
        CREATE TABLE student_document_approvals (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL,
          document_type VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          rejection_reason TEXT,
          reviewed_by INTEGER,
          reviewed_at TIMESTAMP WITH TIME ZONE,
          file_url VARCHAR(500),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_student_document UNIQUE (student_id, document_type),
          CONSTRAINT check_status CHECK (status IN ('pending', 'approved', 'rejected')),
          CONSTRAINT check_document_type CHECK (
            document_type IN (
              'profile_image',
              'birth_certificate',
              'ref_letter',
              'valid_id',
              'resume_cv',
              'certificate_file',
              'other_file'
            )
          )
        );
      `);
      console.log("✅ Table created successfully");

      // Create indexes
      console.log("🔄 Creating indexes...");
      await db.query(`
        CREATE INDEX idx_student_document_approvals_student_id ON student_document_approvals(student_id);
        CREATE INDEX idx_student_document_approvals_status ON student_document_approvals(status);
        CREATE INDEX idx_student_document_approvals_document_type ON student_document_approvals(document_type);
      `);
      console.log("✅ Indexes created successfully");

    } else if (dialect === 'mysql' || dialect === 'mariadb') {
      // MySQL/MariaDB: Create table
      console.log("🔄 Creating student_document_approvals table...");
      await db.query(`
        CREATE TABLE student_document_approvals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          student_id INT NOT NULL,
          document_type ENUM(
            'profile_image',
            'birth_certificate',
            'ref_letter',
            'valid_id',
            'resume_cv',
            'certificate_file',
            'other_file'
          ) NOT NULL,
          status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
          rejection_reason TEXT,
          reviewed_by INT,
          reviewed_at DATETIME,
          file_url VARCHAR(500),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_student_document (student_id, document_type),
          INDEX idx_student_id (student_id),
          INDEX idx_status (status),
          INDEX idx_document_type (document_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log("✅ Table created successfully");
    } else {
      console.error(`❌ Unsupported database dialect: ${dialect}`);
      console.error("Please manually create the student_document_approvals table");
      process.exit(1);
    }

    // Verify the table
    const verifyTable = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'student_document_approvals'
      ORDER BY ordinal_position;
    `, { type: QueryTypes.SELECT });

    if (verifyTable && verifyTable.length > 0) {
      console.log("\n✅ Verification: Table structure:");
      verifyTable.forEach((col) => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }

    console.log("\n==================================================");
    console.log("✅ MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================\n");
    console.log("📋 Summary:");
    console.log("   ✅ student_document_approvals table created");
    console.log("   ✅ Indexes created");
    console.log("   ✅ Constraints added\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrateStudentDocumentApprovals();

