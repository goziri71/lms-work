/**
 * Migration Script: Create Tutor KYC Table
 * 
 * This script creates:
 * 1. tutor_kyc - Stores KYC information and documents for sole tutors
 * 
 * Run: node scripts/migrate-create-tutor-kyc-table.js
 */

import { db } from "../src/database/database.js";

async function createTutorKycTable() {
  try {
    console.log("📦 Starting migration: Tutor KYC System");
    console.log(`Database dialect: ${db.getDialect()}`);

    // Step 1: Create tutor_kyc table
    console.log("\n🔍 Step 1: Creating 'tutor_kyc' table...");
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS tutor_kyc (
        id SERIAL PRIMARY KEY,
        tutor_id INTEGER NOT NULL UNIQUE,
        bvn VARCHAR(11),
        bvn_verified BOOLEAN NOT NULL DEFAULT false,
        bvn_verification_date TIMESTAMP,
        bvn_verification_reference VARCHAR(255),
        bvn_verification_response JSONB,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        date_of_birth DATE,
        phone_number VARCHAR(20),
        national_id_url TEXT,
        national_id_type VARCHAR(50) CHECK (national_id_type IN ('national_id', 'passport', 'drivers_license', 'voters_card', 'other')),
        national_id_number VARCHAR(100),
        proof_of_address_url TEXT,
        passport_photo_url TEXT,
        additional_documents JSONB,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' 
          CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'requires_resubmission')),
        submitted_at TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewed_by INTEGER,
        rejection_reason TEXT,
        resubmission_notes TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_tutor_kyc_tutor 
          FOREIGN KEY (tutor_id) 
          REFERENCES sole_tutors(id) 
          ON DELETE CASCADE
      );
    `);

    // Create indexes
    console.log("\n🔍 Step 2: Creating indexes...");
    
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_kyc_tutor_id 
      ON tutor_kyc(tutor_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tutor_kyc_status 
      ON tutor_kyc(status);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tutor_kyc_bvn_verified 
      ON tutor_kyc(bvn_verified);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tutor_kyc_submitted_at 
      ON tutor_kyc(submitted_at);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tutor_kyc_reviewed_at 
      ON tutor_kyc(reviewed_at);
    `);

    console.log("✅ 'tutor_kyc' table created successfully");
    console.log("✅ Indexes created successfully");

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📋 Summary:");
    console.log("  - tutor_kyc table created");
    console.log("  - Indexes created");
    console.log("\n✨ You can now use the Tutor KYC system!");

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run migration
createTutorKycTable()
  .then(() => {
    console.log("\n🎉 Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Migration script failed:", error);
    process.exit(1);
  });
