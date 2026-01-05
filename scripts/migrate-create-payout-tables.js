/**
 * Migration Script: Create Tutor Payout and Bank Account Tables
 * 
 * This script creates:
 * 1. tutor_bank_accounts - Stores tutor bank account information
 * 2. tutor_payouts - Tracks payout requests and transfers
 * 
 * Run: node scripts/migrate-create-payout-tables.js
 */

import { db } from "../src/database/database.js";

async function createPayoutTables() {
  try {
    console.log("📦 Starting migration: Tutor Payout System");
    console.log(`Database dialect: ${db.getDialect()}`);

    // Step 1: Create tutor_bank_accounts table
    console.log("\n🔍 Step 1: Creating 'tutor_bank_accounts' table...");
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS tutor_bank_accounts (
        id SERIAL PRIMARY KEY,
        tutor_id INTEGER NOT NULL,
        tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
        account_name VARCHAR(255) NOT NULL,
        account_number VARCHAR(50) NOT NULL,
        bank_code VARCHAR(20) NOT NULL,
        bank_name VARCHAR(255) NOT NULL,
        country VARCHAR(100) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
        is_verified BOOLEAN NOT NULL DEFAULT false,
        is_primary BOOLEAN NOT NULL DEFAULT false,
        verification_date TIMESTAMP,
        verification_response JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tutor_bank_accounts_tutor 
      ON tutor_bank_accounts(tutor_id, tutor_type);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tutor_bank_accounts_primary 
      ON tutor_bank_accounts(is_primary);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tutor_bank_accounts_verified 
      ON tutor_bank_accounts(is_verified);
    `);

    console.log("✅ 'tutor_bank_accounts' table created successfully");

    // Step 2: Create tutor_payouts table
    console.log("\n🔍 Step 2: Creating 'tutor_payouts' table...");
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS tutor_payouts (
        id SERIAL PRIMARY KEY,
        tutor_id INTEGER NOT NULL,
        tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
        bank_account_id INTEGER NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        converted_amount DECIMAL(10, 2),
        fx_rate DECIMAL(10, 6),
        transfer_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.0,
        net_amount DECIMAL(10, 2) NOT NULL,
        flutterwave_transfer_id VARCHAR(100),
        flutterwave_reference VARCHAR(100) UNIQUE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' 
          CHECK (status IN ('pending', 'processing', 'successful', 'failed', 'cancelled')),
        failure_reason TEXT,
        processed_at TIMESTAMP,
        completed_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_tutor_payouts_bank_account 
          FOREIGN KEY (bank_account_id) 
          REFERENCES tutor_bank_accounts(id) 
          ON DELETE RESTRICT
      );
    `);

    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tutor_payouts_tutor 
      ON tutor_payouts(tutor_id, tutor_type);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tutor_payouts_status 
      ON tutor_payouts(status);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tutor_payouts_reference 
      ON tutor_payouts(flutterwave_reference);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tutor_payouts_created 
      ON tutor_payouts(created_at);
    `);

    console.log("✅ 'tutor_payouts' table created successfully");

    // Step 3: Add currency field to sole_tutors if not exists
    console.log("\n🔍 Step 3: Checking 'sole_tutors' table for currency field...");
    
    try {
      await db.query(`
        ALTER TABLE sole_tutors 
        ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'NGN';
      `);
      console.log("✅ 'currency' field added to 'sole_tutors' table");
    } catch (error) {
      if (error.message.includes("does not exist")) {
        console.log("⚠️  'sole_tutors' table does not exist, skipping currency field addition");
      } else {
        throw error;
      }
    }

    // Step 4: Add currency field to organizations if not exists
    console.log("\n🔍 Step 4: Checking 'organizations' table for currency field...");
    
    try {
      await db.query(`
        ALTER TABLE organizations 
        ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'NGN';
      `);
      console.log("✅ 'currency' field added to 'organizations' table");
    } catch (error) {
      if (error.message.includes("does not exist")) {
        console.log("⚠️  'organizations' table does not exist, skipping currency field addition");
      } else {
        throw error;
      }
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📋 Summary:");
    console.log("  - tutor_bank_accounts table created");
    console.log("  - tutor_payouts table created");
    console.log("  - Currency fields added to tutor tables");
    console.log("\n✨ You can now use the payout system!");

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run migration
createPayoutTables()
  .then(() => {
    console.log("\n🎉 Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Migration script failed:", error);
    process.exit(1);
  });

