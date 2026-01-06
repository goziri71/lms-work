import { db } from "../src/database/database.js";

/**
 * Migration: Create tutor_wallet_transactions table
 * This table tracks all wallet funding and debit transactions for tutors
 */

async function createTutorWalletTransactionsTable() {
  try {
    // Authenticate database connection
    await db.authenticate();
    console.log("✅ Database connection established successfully.");

    const dialect = db.getDialect();

    console.log("📦 Starting migration: Tutor Wallet Transactions Table");
    console.log(`Database dialect: ${dialect}`);

    // Create tutor_wallet_transactions table
    console.log("\n🔍 Step 1: Creating 'tutor_wallet_transactions' table...");

    if (dialect === "postgres") {
      await db.query(`
        CREATE TABLE IF NOT EXISTS tutor_wallet_transactions (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL,
          tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
          transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
          amount DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          service_name VARCHAR(100) NOT NULL,
          transaction_reference VARCHAR(255),
          flutterwave_transaction_id VARCHAR(100),
          balance_before DECIMAL(10, 2) NOT NULL,
          balance_after DECIMAL(10, 2) NOT NULL,
          related_id INTEGER,
          related_type VARCHAR(50),
          status VARCHAR(20) NOT NULL DEFAULT 'successful' 
            CHECK (status IN ('pending', 'successful', 'failed', 'cancelled')),
          notes TEXT,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_tutor_wallet_transactions_tutor 
        ON tutor_wallet_transactions(tutor_id, tutor_type);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_tutor_wallet_transactions_type 
        ON tutor_wallet_transactions(transaction_type);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_tutor_wallet_transactions_status 
        ON tutor_wallet_transactions(status);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_tutor_wallet_transactions_reference 
        ON tutor_wallet_transactions(transaction_reference);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_tutor_wallet_transactions_created 
        ON tutor_wallet_transactions(created_at);
      `);
    } else if (dialect === "mysql" || dialect === "mariadb") {
      await db.query(`
        CREATE TABLE IF NOT EXISTS tutor_wallet_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tutor_id INT NOT NULL,
          tutor_type ENUM('sole_tutor', 'organization') NOT NULL,
          transaction_type ENUM('credit', 'debit') NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          service_name VARCHAR(100) NOT NULL,
          transaction_reference VARCHAR(255),
          flutterwave_transaction_id VARCHAR(100),
          balance_before DECIMAL(10, 2) NOT NULL,
          balance_after DECIMAL(10, 2) NOT NULL,
          related_id INT,
          related_type VARCHAR(50),
          status ENUM('pending', 'successful', 'failed', 'cancelled') NOT NULL DEFAULT 'successful',
          notes TEXT,
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_tutor (tutor_id, tutor_type),
          INDEX idx_type (transaction_type),
          INDEX idx_status (status),
          INDEX idx_reference (transaction_reference),
          INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } else {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    console.log("✅ 'tutor_wallet_transactions' table created successfully");

    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
createTutorWalletTransactionsTable();

