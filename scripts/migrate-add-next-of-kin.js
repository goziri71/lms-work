/**
 * Migration: Add Next of Kin System
 * Creates tutor_next_of_kin and fund_transfers tables
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function addNextOfKin() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Next of Kin System");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    // Step 1: Create tutor_next_of_kin table
    console.log("🔍 Step 1: Creating 'tutor_next_of_kin' table...");

    const [nextOfKinExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tutor_next_of_kin'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (nextOfKinExists.exists) {
      console.log("   ⏭️  'tutor_next_of_kin' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE tutor_next_of_kin (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL,
          tutor_type VARCHAR(20) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
          full_name VARCHAR(255) NOT NULL,
          relationship VARCHAR(100) NOT NULL,
          email VARCHAR(255),
          phone_number VARCHAR(50) NOT NULL,
          address TEXT,
          identification_type VARCHAR(50) CHECK (identification_type IN ('national_id', 'passport', 'drivers_license', 'voters_card', 'other')),
          identification_number VARCHAR(100),
          identification_document_url TEXT,
          bank_account_name VARCHAR(255),
          bank_account_number VARCHAR(50),
          bank_name VARCHAR(255),
          bank_code VARCHAR(20),
          is_verified BOOLEAN NOT NULL DEFAULT false,
          verified_at TIMESTAMP,
          verified_by INTEGER,
          status VARCHAR(30) NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('active', 'inactive', 'pending_verification')),
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_tutor_next_of_kin UNIQUE (tutor_id, tutor_type)
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_tutor_next_of_kin_tutor ON tutor_next_of_kin(tutor_id, tutor_type);
        CREATE INDEX idx_tutor_next_of_kin_status ON tutor_next_of_kin(status);
        CREATE INDEX idx_tutor_next_of_kin_verified ON tutor_next_of_kin(is_verified);
      `);

      console.log("   ✅ 'tutor_next_of_kin' table created successfully.");
    }

    // Step 2: Create fund_transfers table
    console.log("\n🔍 Step 2: Creating 'fund_transfers' table...");

    const [fundTransfersExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'fund_transfers'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (fundTransfersExists.exists) {
      console.log("   ⏭️  'fund_transfers' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE fund_transfers (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL,
          tutor_type VARCHAR(20) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
          next_of_kin_id INTEGER NOT NULL,
          transfer_reason VARCHAR(20) NOT NULL CHECK (transfer_reason IN ('death', 'inactivity', 'account_closure', 'other')),
          reason_description TEXT,
          amount_primary DECIMAL(10, 2) NOT NULL DEFAULT 0.0,
          amount_usd DECIMAL(10, 2) NOT NULL DEFAULT 0.0,
          amount_gbp DECIMAL(10, 2) NOT NULL DEFAULT 0.0,
          currency_primary VARCHAR(10) NOT NULL,
          total_amount_ngn_equivalent DECIMAL(10, 2),
          transfer_method VARCHAR(20) NOT NULL CHECK (transfer_method IN ('bank_transfer', 'wallet', 'check', 'other')),
          transfer_reference VARCHAR(255),
          initiated_by INTEGER NOT NULL,
          initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
          failure_reason TEXT,
          supporting_documents JSONB,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_fund_transfers_next_of_kin 
            FOREIGN KEY (next_of_kin_id) 
            REFERENCES tutor_next_of_kin(id) 
            ON DELETE RESTRICT
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_fund_transfers_tutor ON fund_transfers(tutor_id, tutor_type);
        CREATE INDEX idx_fund_transfers_next_of_kin ON fund_transfers(next_of_kin_id);
        CREATE INDEX idx_fund_transfers_initiated_by ON fund_transfers(initiated_by);
        CREATE INDEX idx_fund_transfers_status ON fund_transfers(status);
        CREATE INDEX idx_fund_transfers_initiated_at ON fund_transfers(initiated_at);
      `);

      console.log("   ✅ 'fund_transfers' table created successfully.");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update models index to export TutorNextOfKin and FundTransfer");
    console.log("   2. Create next of kin CRUD endpoints for tutors");
    console.log("   3. Create admin fund transfer initiation endpoints\n");

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

addNextOfKin();
