import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to add multi-currency wallet support
 * 
 * This script:
 * 1. Adds country_code and local_currency to tutor tables
 * 2. Adds 3 wallet balance fields (primary, USD, GBP)
 * 3. Migrates existing wallet_balance to wallet_balance_primary
 * 4. Creates currency_exchange_rates table
 * 5. Creates currency_conversions table
 * 
 * Run with: node scripts/migrate-add-multi-currency-wallet.js
 */

// Country to currency mapping
const COUNTRY_CURRENCY_MAP = {
  'NG': 'NGN',  // Nigeria
  'GB': 'GBP',  // United Kingdom
  'US': 'USD',  // United States
  'KE': 'KES',  // Kenya
  'GH': 'GHS',  // Ghana
  'ZA': 'ZAR',  // South Africa
  'EG': 'EGP',  // Egypt
  // Add more as needed
};

async function addMultiCurrencyWallet() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Multi-Currency Wallet System\n");

    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    // Step 1: Add country_code and local_currency to sole_tutors
    console.log("🔍 Step 1: Adding country_code and local_currency to 'sole_tutors' table...");
    const soleTutorColumnsResult = await db.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'sole_tutors' 
       AND column_name IN ('country_code', 'local_currency');`,
      { type: QueryTypes.SELECT }
    );

    const soleTutorColumns = Array.isArray(soleTutorColumnsResult) ? soleTutorColumnsResult : [];
    const existingSoleTutorColumns = soleTutorColumns.map((col) => col.column_name);

    if (!existingSoleTutorColumns.includes("country_code")) {
      await db.query(`
        ALTER TABLE sole_tutors 
        ADD COLUMN country_code VARCHAR(2);
      `);
      console.log("✅ Added 'country_code' column to sole_tutors.\n");
    } else {
      console.log("⏭️  'country_code' column already exists. Skipping...\n");
    }

    if (!existingSoleTutorColumns.includes("local_currency")) {
      await db.query(`
        ALTER TABLE sole_tutors 
        ADD COLUMN local_currency VARCHAR(3) DEFAULT 'NGN';
      `);
      console.log("✅ Added 'local_currency' column to sole_tutors.\n");
    } else {
      console.log("⏭️  'local_currency' column already exists. Skipping...\n");
    }

    // Step 2: Add wallet balance fields to sole_tutors
    console.log("🔍 Step 2: Adding multi-currency wallet fields to 'sole_tutors' table...");
    const soleTutorWalletColumnsResult = await db.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'sole_tutors' 
       AND column_name IN ('wallet_balance_primary', 'wallet_balance_usd', 'wallet_balance_gbp');`,
      { type: QueryTypes.SELECT }
    );

    const soleTutorWalletColumns = Array.isArray(soleTutorWalletColumnsResult) ? soleTutorWalletColumnsResult : [];
    const existingWalletColumns = soleTutorWalletColumns.map((col) => col.column_name);

    if (!existingWalletColumns.includes("wallet_balance_primary")) {
      await db.query(`
        ALTER TABLE sole_tutors 
        ADD COLUMN wallet_balance_primary DECIMAL(10, 2) DEFAULT 0.0;
      `);
      console.log("✅ Added 'wallet_balance_primary' column to sole_tutors.\n");
    } else {
      console.log("⏭️  'wallet_balance_primary' column already exists. Skipping...\n");
    }

    if (!existingWalletColumns.includes("wallet_balance_usd")) {
      await db.query(`
        ALTER TABLE sole_tutors 
        ADD COLUMN wallet_balance_usd DECIMAL(10, 2) DEFAULT 0.0;
      `);
      console.log("✅ Added 'wallet_balance_usd' column to sole_tutors.\n");
    } else {
      console.log("⏭️  'wallet_balance_usd' column already exists. Skipping...\n");
    }

    if (!existingWalletColumns.includes("wallet_balance_gbp")) {
      await db.query(`
        ALTER TABLE sole_tutors 
        ADD COLUMN wallet_balance_gbp DECIMAL(10, 2) DEFAULT 0.0;
      `);
      console.log("✅ Added 'wallet_balance_gbp' column to sole_tutors.\n");
    } else {
      console.log("⏭️  'wallet_balance_gbp' column already exists. Skipping...\n");
    }

    // Step 3: Migrate existing wallet_balance to wallet_balance_primary
    console.log("🔍 Step 3: Migrating existing wallet_balance to wallet_balance_primary...");
    const hasPrimaryBalanceResult = await db.query(
      `SELECT COUNT(*)::INTEGER as count 
       FROM sole_tutors 
       WHERE (wallet_balance_primary IS NULL OR wallet_balance_primary = 0) 
       AND wallet_balance > 0;`,
      { type: QueryTypes.SELECT }
    );

    const hasPrimaryBalance = Array.isArray(hasPrimaryBalanceResult) && hasPrimaryBalanceResult.length > 0 
      ? hasPrimaryBalanceResult[0] 
      : { count: 0 };
    const count = parseInt(hasPrimaryBalance.count) || 0;

    if (count > 0) {
      // Update country_code and local_currency based on existing country/currency
      await db.query(`
        UPDATE sole_tutors
        SET 
          country_code = CASE 
            WHEN country = 'Nigeria' OR country LIKE '%Nigeria%' THEN 'NG'
            WHEN country = 'United Kingdom' OR country LIKE '%UK%' OR country LIKE '%United Kingdom%' THEN 'GB'
            WHEN country = 'United States' OR country LIKE '%USA%' OR country LIKE '%United States%' THEN 'US'
            WHEN country = 'Kenya' THEN 'KE'
            WHEN country = 'Ghana' THEN 'GH'
            WHEN country = 'South Africa' THEN 'ZA'
            WHEN country = 'Egypt' THEN 'EG'
            ELSE 'NG'
          END,
          local_currency = CASE 
            WHEN currency = 'NGN' THEN 'NGN'
            WHEN currency = 'GBP' THEN 'GBP'
            WHEN currency = 'USD' THEN 'USD'
            WHEN currency = 'KES' THEN 'KES'
            WHEN currency = 'GHS' THEN 'GHS'
            WHEN currency = 'ZAR' THEN 'ZAR'
            WHEN currency = 'EGP' THEN 'EGP'
            ELSE COALESCE(currency, 'NGN')
          END,
          wallet_balance_primary = COALESCE(wallet_balance, 0.0)
        WHERE wallet_balance_primary IS NULL OR wallet_balance_primary = 0;
      `);
      console.log(`✅ Migrated ${count} tutor wallet balances.\n`);
    } else {
      console.log("⏭️  No wallet balances to migrate.\n");
    }

    // Step 4: Add same fields to organizations
    console.log("🔍 Step 4: Adding fields to 'organizations' table...");
    const orgColumnsResult = await db.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'organizations' 
       AND column_name IN ('country_code', 'local_currency', 'wallet_balance_primary', 'wallet_balance_usd', 'wallet_balance_gbp');`,
      { type: QueryTypes.SELECT }
    );

    const orgColumns = Array.isArray(orgColumnsResult) ? orgColumnsResult : [];
    const existingOrgColumns = orgColumns.map((col) => col.column_name);

    if (!existingOrgColumns.includes("country_code")) {
      await db.query(`
        ALTER TABLE organizations 
        ADD COLUMN country_code VARCHAR(2);
      `);
      console.log("✅ Added 'country_code' column to organizations.\n");
    } else {
      console.log("⏭️  'country_code' column already exists in organizations. Skipping...\n");
    }

    if (!existingOrgColumns.includes("local_currency")) {
      await db.query(`
        ALTER TABLE organizations 
        ADD COLUMN local_currency VARCHAR(3) DEFAULT 'NGN';
      `);
      console.log("✅ Added 'local_currency' column to organizations.\n");
    } else {
      console.log("⏭️  'local_currency' column already exists in organizations. Skipping...\n");
    }

    if (!existingOrgColumns.includes("wallet_balance_primary")) {
      await db.query(`
        ALTER TABLE organizations 
        ADD COLUMN wallet_balance_primary DECIMAL(10, 2) DEFAULT 0.0;
      `);
      console.log("✅ Added 'wallet_balance_primary' column to organizations.\n");
    } else {
      console.log("⏭️  'wallet_balance_primary' column already exists in organizations. Skipping...\n");
    }

    if (!existingOrgColumns.includes("wallet_balance_usd")) {
      await db.query(`
        ALTER TABLE organizations 
        ADD COLUMN wallet_balance_usd DECIMAL(10, 2) DEFAULT 0.0;
      `);
      console.log("✅ Added 'wallet_balance_usd' column to organizations.\n");
    } else {
      console.log("⏭️  'wallet_balance_usd' column already exists in organizations. Skipping...\n");
    }

    if (!existingOrgColumns.includes("wallet_balance_gbp")) {
      await db.query(`
        ALTER TABLE organizations 
        ADD COLUMN wallet_balance_gbp DECIMAL(10, 2) DEFAULT 0.0;
      `);
      console.log("✅ Added 'wallet_balance_gbp' column to organizations.\n");
    } else {
      console.log("⏭️  'wallet_balance_gbp' column already exists in organizations. Skipping...\n");
    }

    // Migrate organization wallet balances
    await db.query(`
      UPDATE organizations
      SET 
        country_code = CASE 
          WHEN country = 'Nigeria' OR country LIKE '%Nigeria%' THEN 'NG'
          WHEN country = 'United Kingdom' OR country LIKE '%UK%' OR country LIKE '%United Kingdom%' THEN 'GB'
          WHEN country = 'United States' OR country LIKE '%USA%' OR country LIKE '%United States%' THEN 'US'
          WHEN country = 'Kenya' THEN 'KE'
          WHEN country = 'Ghana' THEN 'GH'
          WHEN country = 'South Africa' THEN 'ZA'
          WHEN country = 'Egypt' THEN 'EG'
          ELSE 'NG'
        END,
        local_currency = CASE 
          WHEN currency = 'NGN' THEN 'NGN'
          WHEN currency = 'GBP' THEN 'GBP'
          WHEN currency = 'USD' THEN 'USD'
          WHEN currency = 'KES' THEN 'KES'
          WHEN currency = 'GHS' THEN 'GHS'
          WHEN currency = 'ZAR' THEN 'ZAR'
          WHEN currency = 'EGP' THEN 'EGP'
          ELSE COALESCE(currency, 'NGN')
        END,
        wallet_balance_primary = COALESCE(wallet_balance, 0.0)
      WHERE wallet_balance_primary IS NULL OR wallet_balance_primary = 0;
    `);
    console.log("✅ Migrated organization wallet balances.\n");

    // Step 5: Create currency_exchange_rates table
    console.log("🔍 Step 5: Creating 'currency_exchange_rates' table...");
    const [exchangeRatesTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'currency_exchange_rates'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!exchangeRatesTableExists.exists) {
      await db.query(`
        CREATE TABLE currency_exchange_rates (
          id SERIAL PRIMARY KEY,
          from_currency VARCHAR(3) NOT NULL,
          to_currency VARCHAR(3) NOT NULL,
          rate DECIMAL(15, 6) NOT NULL,
          source VARCHAR(100) NOT NULL DEFAULT 'api',
          is_active BOOLEAN DEFAULT true,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_currency_pair 
            UNIQUE (from_currency, to_currency)
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_currency_exchange_rates_pair ON currency_exchange_rates(from_currency, to_currency);
        CREATE INDEX idx_currency_exchange_rates_active ON currency_exchange_rates(is_active);
        CREATE INDEX idx_currency_exchange_rates_updated ON currency_exchange_rates(updated_at);
      `);

      // Insert initial exchange rates (will be updated by cron job)
      await db.query(`
        INSERT INTO currency_exchange_rates (from_currency, to_currency, rate, source) VALUES
        ('NGN', 'USD', 0.00068, 'initial'),
        ('NGN', 'GBP', 0.00051, 'initial'),
        ('USD', 'NGN', 1465.33, 'initial'),
        ('USD', 'GBP', 0.79, 'initial'),
        ('GBP', 'NGN', 1941.17, 'initial'),
        ('GBP', 'USD', 1.27, 'initial')
        ON CONFLICT (from_currency, to_currency) DO NOTHING;
      `);

      console.log("✅ 'currency_exchange_rates' table created successfully.\n");
    } else {
      console.log("⏭️  'currency_exchange_rates' table already exists. Skipping...\n");
    }

    // Step 6: Create currency_conversions table
    console.log("🔍 Step 6: Creating 'currency_conversions' table...");
    const [conversionsTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'currency_conversions'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!conversionsTableExists.exists) {
      await db.query(`
        CREATE TABLE currency_conversions (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL,
          tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
          from_currency VARCHAR(3) NOT NULL,
          to_currency VARCHAR(3) NOT NULL,
          from_amount DECIMAL(10, 2) NOT NULL,
          to_amount DECIMAL(10, 2) NOT NULL,
          exchange_rate DECIMAL(15, 6) NOT NULL,
          conversion_fee DECIMAL(10, 2) DEFAULT 0.0,
          converted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_currency_conversions_tutor ON currency_conversions(tutor_id, tutor_type);
        CREATE INDEX idx_currency_conversions_currencies ON currency_conversions(from_currency, to_currency);
        CREATE INDEX idx_currency_conversions_date ON currency_conversions(converted_at);
      `);

      console.log("✅ 'currency_conversions' table created successfully.\n");
    } else {
      console.log("⏭️  'currency_conversions' table already exists. Skipping...\n");
    }

    // Step 7: Verify tutor_wallet_transactions has currency field
    console.log("🔍 Step 7: Verifying 'tutor_wallet_transactions' has currency field...");
    const txnColumns = await db.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'tutor_wallet_transactions' 
       AND column_name = 'currency';`,
      { type: QueryTypes.SELECT }
    );

    const hasCurrencyField = Array.isArray(txnColumns) && txnColumns.length > 0;

    if (!hasCurrencyField) {
      await db.query(`
        ALTER TABLE tutor_wallet_transactions 
        ADD COLUMN currency VARCHAR(10) DEFAULT 'NGN';
      `);
      
      // Update existing transactions to use NGN as default
      await db.query(`
        UPDATE tutor_wallet_transactions 
        SET currency = 'NGN' 
        WHERE currency IS NULL;
      `);
      
      console.log("✅ Added 'currency' column to tutor_wallet_transactions.\n");
    } else {
      console.log("⏭️  'currency' column already exists in tutor_wallet_transactions.");
      
      // Update any NULL currency values to NGN
      const nullCountResult = await db.query(
        `SELECT COUNT(*)::INTEGER as count 
         FROM tutor_wallet_transactions 
         WHERE currency IS NULL;`,
        { type: QueryTypes.SELECT }
      );
      
      const nullCount = Array.isArray(nullCountResult) && nullCountResult.length > 0 
        ? nullCountResult[0] 
        : { count: 0 };
      const nullCountValue = parseInt(nullCount.count) || 0;
      
      if (nullCountValue > 0) {
        await db.query(`
          UPDATE tutor_wallet_transactions 
          SET currency = 'NGN' 
          WHERE currency IS NULL;
        `);
        console.log(`✅ Updated ${nullCountValue} transactions with NULL currency to NGN.\n`);
      } else {
        console.log("✅ All transactions already have currency set.\n");
      }
    }

    console.log("✅ Migration completed successfully!");
    console.log("\n📋 Summary:");
    console.log("   - Added country_code and local_currency to tutor tables");
    console.log("   - Added wallet_balance_primary, wallet_balance_usd, wallet_balance_gbp");
    console.log("   - Migrated existing wallet_balance to wallet_balance_primary");
    console.log("   - Created currency_exchange_rates table");
    console.log("   - Created currency_conversions table");
    console.log("   - Verified tutor_wallet_transactions currency field");
    console.log("\n✨ Multi-currency wallet system is ready!");
    console.log("\n⚠️  NOTE: Exchange rates will be updated by cron job. Initial rates are placeholders.");

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

// Run migration
addMultiCurrencyWallet();
