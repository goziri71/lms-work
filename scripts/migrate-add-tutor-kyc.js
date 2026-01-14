/**
 * Migration: Add Tutor KYC System
 * Creates tutor_kyc table for sole tutor KYC verification
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function addTutorKyc() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Tutor KYC System");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    // Step 1: Create tutor_kyc table
    console.log("🔍 Step 1: Creating 'tutor_kyc' table...");

    const [kycExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tutor_kyc'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (kycExists.exists) {
      console.log("   ⏭️  'tutor_kyc' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE tutor_kyc (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL UNIQUE,
          bvn VARCHAR(11),
          bvn_verified BOOLEAN NOT NULL DEFAULT false,
          bvn_verification_date TIMESTAMP,
          bvn_verification_reference VARCHAR(255),
          bvn_verification_response JSONB,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          date_of_birth TIMESTAMP,
          phone_number VARCHAR(20),
          national_id_url TEXT,
          national_id_type VARCHAR(30) CHECK (national_id_type IN ('national_id', 'passport', 'drivers_license', 'voters_card', 'other')),
          national_id_number VARCHAR(100),
          proof_of_address_url TEXT,
          passport_photo_url TEXT,
          additional_documents JSONB,
          status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'requires_resubmission')),
          submitted_at TIMESTAMP,
          reviewed_at TIMESTAMP,
          reviewed_by INTEGER,
          rejection_reason TEXT,
          resubmission_notes TEXT,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_tutor_kyc_tutor 
            FOREIGN KEY (tutor_id) 
            REFERENCES sole_tutors(id) 
            ON DELETE CASCADE
        );
      `);

      // Create indexes
      await db.query(`
        CREATE UNIQUE INDEX idx_tutor_kyc_tutor_id ON tutor_kyc(tutor_id);
        CREATE INDEX idx_tutor_kyc_status ON tutor_kyc(status);
        CREATE INDEX idx_tutor_kyc_bvn_verified ON tutor_kyc(bvn_verified);
        CREATE INDEX idx_tutor_kyc_submitted_at ON tutor_kyc(submitted_at);
        CREATE INDEX idx_tutor_kyc_reviewed_at ON tutor_kyc(reviewed_at);
      `);

      console.log("   ✅ 'tutor_kyc' table created successfully.");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update models index to export TutorKyc");
    console.log("   2. Create KYC submission and document upload endpoints");
    console.log("   3. Create admin KYC review dashboard endpoints");
    console.log("   4. Integrate BVN verification API (VerifyMe or manual)\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    process.exit(1);
  }
}

addTutorKyc();
