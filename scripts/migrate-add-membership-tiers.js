import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to add membership tier system tables
 * 
 * This script creates:
 * 1. membership_tiers - Tiers within memberships
 * 2. membership_tier_products - Products assigned to tiers with access levels
 * 3. membership_tier_changes - History of tier upgrades/downgrades
 * 4. Adds tier_id and tier_name to membership_subscriptions table
 * 
 * Run with: node scripts/migrate-add-membership-tiers.js
 */

async function addMembershipTiers() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Membership Tier System\n");

    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    // Step 1: Create membership_tiers table
    console.log("🔍 Step 1: Creating 'membership_tiers' table...");
    const [tiersTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'membership_tiers'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!tiersTableExists.exists) {
      await db.query(`
        CREATE TABLE membership_tiers (
          id SERIAL PRIMARY KEY,
          membership_id INTEGER NOT NULL,
          tier_name VARCHAR(255) NOT NULL,
          description TEXT,
          monthly_price DECIMAL(10, 2),
          yearly_price DECIMAL(10, 2),
          lifetime_price DECIMAL(10, 2),
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          display_order INTEGER NOT NULL DEFAULT 0,
          status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_membership_tiers_membership 
            FOREIGN KEY (membership_id) 
            REFERENCES memberships(id) 
            ON DELETE CASCADE,
          CONSTRAINT unique_membership_tier_name 
            UNIQUE (membership_id, tier_name)
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_membership_tiers_membership ON membership_tiers(membership_id);
        CREATE INDEX idx_membership_tiers_status ON membership_tiers(status);
        CREATE INDEX idx_membership_tiers_display_order ON membership_tiers(display_order);
      `);

      console.log("✅ 'membership_tiers' table created successfully.\n");
    } else {
      console.log("⏭️  'membership_tiers' table already exists. Skipping...\n");
    }

    // Step 2: Create membership_tier_products table
    console.log("🔍 Step 2: Creating 'membership_tier_products' table...");
    const [tierProductsTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'membership_tier_products'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!tierProductsTableExists.exists) {
      await db.query(`
        CREATE TABLE membership_tier_products (
          id SERIAL PRIMARY KEY,
          tier_id INTEGER NOT NULL,
          product_type VARCHAR(50) NOT NULL CHECK (product_type IN ('course', 'ebook', 'digital_download', 'coaching_session', 'community')),
          product_id INTEGER NOT NULL,
          monthly_access_level TEXT,
          yearly_access_level TEXT,
          lifetime_access_level TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_membership_tier_products_tier 
            FOREIGN KEY (tier_id) 
            REFERENCES membership_tiers(id) 
            ON DELETE CASCADE,
          CONSTRAINT unique_tier_product 
            UNIQUE (tier_id, product_type, product_id)
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_membership_tier_products_tier ON membership_tier_products(tier_id);
        CREATE INDEX idx_membership_tier_products_product ON membership_tier_products(product_type, product_id);
      `);

      console.log("✅ 'membership_tier_products' table created successfully.\n");
    } else {
      console.log("⏭️  'membership_tier_products' table already exists. Skipping...\n");
    }

    // Step 3: Create membership_tier_changes table
    console.log("🔍 Step 3: Creating 'membership_tier_changes' table...");
    const [tierChangesTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'membership_tier_changes'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!tierChangesTableExists.exists) {
      await db.query(`
        CREATE TABLE membership_tier_changes (
          id SERIAL PRIMARY KEY,
          subscription_id INTEGER NOT NULL,
          old_tier_id INTEGER,
          old_tier_name VARCHAR(255),
          new_tier_id INTEGER NOT NULL,
          new_tier_name VARCHAR(255) NOT NULL,
          change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('upgrade', 'downgrade', 'initial')),
          payment_amount DECIMAL(10, 2),
          refund_amount DECIMAL(10, 2),
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          effective_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_membership_tier_changes_subscription 
            FOREIGN KEY (subscription_id) 
            REFERENCES membership_subscriptions(id) 
            ON DELETE CASCADE,
          CONSTRAINT fk_membership_tier_changes_old_tier 
            FOREIGN KEY (old_tier_id) 
            REFERENCES membership_tiers(id) 
            ON DELETE SET NULL,
          CONSTRAINT fk_membership_tier_changes_new_tier 
            FOREIGN KEY (new_tier_id) 
            REFERENCES membership_tiers(id) 
            ON DELETE RESTRICT
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_membership_tier_changes_subscription ON membership_tier_changes(subscription_id);
        CREATE INDEX idx_membership_tier_changes_old_tier ON membership_tier_changes(old_tier_id);
        CREATE INDEX idx_membership_tier_changes_new_tier ON membership_tier_changes(new_tier_id);
        CREATE INDEX idx_membership_tier_changes_type ON membership_tier_changes(change_type);
        CREATE INDEX idx_membership_tier_changes_effective_date ON membership_tier_changes(effective_date);
      `);

      console.log("✅ 'membership_tier_changes' table created successfully.\n");
    } else {
      console.log("⏭️  'membership_tier_changes' table already exists. Skipping...\n");
    }

    // Step 4: Add tier_id and tier_name to membership_subscriptions
    console.log("🔍 Step 4: Adding tier fields to 'membership_subscriptions' table...");
    const subscriptionsColumns = await db.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'membership_subscriptions' 
       AND column_name IN ('tier_id', 'tier_name');`,
      { type: QueryTypes.SELECT }
    );

    const existingColumns = Array.isArray(subscriptionsColumns) 
      ? subscriptionsColumns.map((col) => col.column_name) 
      : [];

    if (!existingColumns.includes("tier_id")) {
      await db.query(`
        ALTER TABLE membership_subscriptions 
        ADD COLUMN tier_id INTEGER,
        ADD CONSTRAINT fk_membership_subscriptions_tier 
          FOREIGN KEY (tier_id) 
          REFERENCES membership_tiers(id) 
          ON DELETE SET NULL;
      `);
      console.log("✅ Added 'tier_id' column to membership_subscriptions.\n");
    } else {
      console.log("⏭️  'tier_id' column already exists. Skipping...\n");
    }

    if (!existingColumns.includes("tier_name")) {
      await db.query(`
        ALTER TABLE membership_subscriptions 
        ADD COLUMN tier_name VARCHAR(255);
      `);
      console.log("✅ Added 'tier_name' column to membership_subscriptions.\n");
    } else {
      console.log("⏭️  'tier_name' column already exists. Skipping...\n");
    }

    // Add index for tier_id
    const [tierIdIndexExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'membership_subscriptions' 
        AND indexname = 'idx_membership_subscriptions_tier_id'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!tierIdIndexExists.exists) {
      await db.query(`
        CREATE INDEX idx_membership_subscriptions_tier_id ON membership_subscriptions(tier_id);
      `);
      console.log("✅ Added index for 'tier_id'.\n");
    }

    console.log("✅ Migration completed successfully!");
    console.log("\n📋 Summary:");
    console.log("   - membership_tiers table");
    console.log("   - membership_tier_products table");
    console.log("   - membership_tier_changes table");
    console.log("   - Added tier_id and tier_name to membership_subscriptions");
    console.log("\n✨ All membership tier tables are ready to use!");

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
addMembershipTiers();
