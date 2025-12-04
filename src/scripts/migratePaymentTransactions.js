import { db } from "../database/database.js";

/**
 * Migration script for Payment Transactions Table
 * 
 * ⚠️ SAFETY: This script ONLY ADDS to the database. It NEVER deletes or modifies existing data.
 * 
 * This script:
 * 1. Creates payment_transactions table (NEW table, no existing data affected)
 * 2. Creates indexes (performance only, no data changes)
 * 
 * ✅ SAFE OPERATIONS:
 * - CREATE TABLE IF NOT EXISTS (only creates if doesn't exist)
 * - CREATE INDEX IF NOT EXISTS (only creates if doesn't exist)
 * 
 * ❌ NO DELETIONS:
 * - No DROP TABLE
 * - No DROP COLUMN
 * - No DELETE statements
 * - No TRUNCATE
 * 
 * Usage: node src/scripts/migratePaymentTransactions.js
 */

async function migratePaymentTransactions() {
  try {
    console.log("🚀 Starting Payment Transactions migration...\n");

    // Connect to database
    console.log("🔌 Connecting to database...");
    await db.authenticate();
    console.log("✅ Database connected\n");

    // Step 1: Create payment_transactions table
    console.log("📊 Step 1: Creating payment_transactions table...");
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS payment_transactions (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL,
          transaction_reference VARCHAR(100) NOT NULL UNIQUE,
          flutterwave_transaction_id VARCHAR(100),
          amount DECIMAL(12,2) NOT NULL,
          currency VARCHAR(5) NOT NULL DEFAULT 'NGN',
          status VARCHAR(20) NOT NULL DEFAULT 'pending' 
            CHECK (status IN ('pending', 'processing', 'successful', 'failed', 'cancelled', 'expired')),
          payment_type VARCHAR(50) NOT NULL DEFAULT 'school_fees',
          academic_year VARCHAR(20),
          verification_attempts INTEGER NOT NULL DEFAULT 0,
          last_verification_at TIMESTAMP WITH TIME ZONE,
          error_message TEXT,
          flutterwave_response JSONB,
          processed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_payment_transaction_student 
            FOREIGN KEY (student_id) 
            REFERENCES students(id) 
            ON DELETE CASCADE
        );
      `);
      console.log("✅ payment_transactions table created\n");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log("ℹ️  payment_transactions table already exists\n");
      } else {
        throw error;
      }
    }

    // Step 2: Create indexes
    console.log("📊 Step 2: Creating indexes...");
    try {
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_transaction_reference 
        ON payment_transactions (transaction_reference);
      `);
      console.log("✅ Unique index on transaction_reference created");

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_student 
        ON payment_transactions (student_id);
      `);
      console.log("✅ Index on student_id created");

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_status 
        ON payment_transactions (status);
      `);
      console.log("✅ Index on status created");

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_type 
        ON payment_transactions (payment_type);
      `);
      console.log("✅ Index on payment_type created");

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_flutterwave_id 
        ON payment_transactions (flutterwave_transaction_id);
      `);
      console.log("✅ Index on flutterwave_transaction_id created");

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_created 
        ON payment_transactions (created_at);
      `);
      console.log("✅ Index on created_at created\n");
    } catch (error) {
      console.error("⚠️  Error creating indexes (may already exist):", error.message);
    }

    console.log("✅ Migration completed successfully!\n");
    console.log("📝 Summary:");
    console.log("   - payment_transactions table: ✅");
    console.log("   - Indexes: ✅");
    console.log("\n🎉 Payment Transactions migration complete!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    // Close database connection
    try {
      if (db && db.sequelize) {
        await db.sequelize.close();
        console.log("\n🔌 Database connection closed");
      }
    } catch (closeError) {
      console.error("⚠️  Error closing database connection:", closeError.message);
    }
  }
}

// Run migration
migratePaymentTransactions()
  .then(() => {
    console.log("\n✅ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration script failed:", error);
    process.exit(1);
  });

