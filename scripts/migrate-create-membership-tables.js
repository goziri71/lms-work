import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to create membership system tables
 * 
 * This script creates:
 * 1. memberships - Tutor-created memberships
 * 2. membership_products - Products bundled in memberships
 * 3. membership_subscriptions - Learner subscriptions to memberships
 * 4. membership_payments - Payment records for membership subscriptions
 * 
 * Run with: node scripts/migrate-create-membership-tables.js
 */

async function createMembershipTables() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Membership System\n");

    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    // Step 1: Create memberships table
    console.log("🔍 Step 1: Creating 'memberships' table...");
    const [membershipsTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'memberships'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!membershipsTableExists.exists) {
      await db.query(`
        CREATE TABLE memberships (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL,
          tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(100) CHECK (category IN (
            'Business & Management',
            'Technology & Data',
            'Engineering & Physical Science',
            'Health & Medicine',
            'Arts & Humanities',
            'Personal Development & Education'
          )),
          image_url TEXT,
          pricing_type VARCHAR(50) NOT NULL DEFAULT 'monthly' CHECK (pricing_type IN ('free', 'monthly', 'yearly', 'lifetime')),
          price DECIMAL(10, 2) NOT NULL DEFAULT 0,
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
          commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_memberships_tutor ON memberships(tutor_id, tutor_type);
        CREATE INDEX idx_memberships_status ON memberships(status);
        CREATE INDEX idx_memberships_pricing_type ON memberships(pricing_type);
      `);

      console.log("✅ 'memberships' table created successfully.\n");
    } else {
      console.log("⏭️  'memberships' table already exists. Skipping...\n");
    }

    // Step 2: Create membership_products table
    console.log("🔍 Step 2: Creating 'membership_products' table...");
    const [productsTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'membership_products'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!productsTableExists.exists) {
      await db.query(`
        CREATE TABLE membership_products (
          id SERIAL PRIMARY KEY,
          membership_id INTEGER NOT NULL,
          product_type VARCHAR(50) NOT NULL CHECK (product_type IN ('course', 'ebook', 'digital_download', 'coaching_session', 'community')),
          product_id INTEGER NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_membership_products_membership 
            FOREIGN KEY (membership_id) 
            REFERENCES memberships(id) 
            ON DELETE CASCADE,
          CONSTRAINT unique_membership_product 
            UNIQUE (membership_id, product_type, product_id)
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_membership_products_membership ON membership_products(membership_id);
        CREATE INDEX idx_membership_products_product ON membership_products(product_type, product_id);
      `);

      console.log("✅ 'membership_products' table created successfully.\n");
    } else {
      console.log("⏭️  'membership_products' table already exists. Skipping...\n");
    }

    // Step 3: Create membership_subscriptions table
    console.log("🔍 Step 3: Creating 'membership_subscriptions' table...");
    const [subscriptionsTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'membership_subscriptions'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!subscriptionsTableExists.exists) {
      await db.query(`
        CREATE TABLE membership_subscriptions (
          id SERIAL PRIMARY KEY,
          membership_id INTEGER NOT NULL,
          student_id INTEGER NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
          start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          end_date TIMESTAMP,
          next_payment_date TIMESTAMP,
          auto_renew BOOLEAN DEFAULT true,
          cancelled_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_membership_subscriptions_membership 
            FOREIGN KEY (membership_id) 
            REFERENCES memberships(id) 
            ON DELETE CASCADE,
          CONSTRAINT fk_membership_subscriptions_student 
            FOREIGN KEY (student_id) 
            REFERENCES students(id) 
            ON DELETE CASCADE,
          CONSTRAINT unique_student_membership 
            UNIQUE (student_id, membership_id)
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_membership_subscriptions_student ON membership_subscriptions(student_id);
        CREATE INDEX idx_membership_subscriptions_membership ON membership_subscriptions(membership_id);
        CREATE INDEX idx_membership_subscriptions_status ON membership_subscriptions(status);
        CREATE INDEX idx_membership_subscriptions_next_payment ON membership_subscriptions(next_payment_date);
      `);

      console.log("✅ 'membership_subscriptions' table created successfully.\n");
    } else {
      console.log("⏭️  'membership_subscriptions' table already exists. Skipping...\n");
    }

    // Step 4: Create membership_payments table
    console.log("🔍 Step 4: Creating 'membership_payments' table...");
    const [paymentsTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'membership_payments'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!paymentsTableExists.exists) {
      await db.query(`
        CREATE TABLE membership_payments (
          id SERIAL PRIMARY KEY,
          subscription_id INTEGER NOT NULL,
          membership_id INTEGER NOT NULL,
          student_id INTEGER NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('wallet', 'flutterwave', 'bank_transfer', 'other')),
          payment_reference VARCHAR(255),
          status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
          payment_period VARCHAR(50) NOT NULL CHECK (payment_period IN ('monthly', 'yearly', 'lifetime')),
          paid_at TIMESTAMP,
          metadata JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_membership_payments_subscription 
            FOREIGN KEY (subscription_id) 
            REFERENCES membership_subscriptions(id) 
            ON DELETE CASCADE,
          CONSTRAINT fk_membership_payments_membership 
            FOREIGN KEY (membership_id) 
            REFERENCES memberships(id) 
            ON DELETE CASCADE,
          CONSTRAINT fk_membership_payments_student 
            FOREIGN KEY (student_id) 
            REFERENCES students(id) 
            ON DELETE CASCADE
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_membership_payments_subscription ON membership_payments(subscription_id);
        CREATE INDEX idx_membership_payments_student ON membership_payments(student_id);
        CREATE INDEX idx_membership_payments_membership ON membership_payments(membership_id);
        CREATE INDEX idx_membership_payments_status ON membership_payments(status);
        CREATE INDEX idx_membership_payments_reference ON membership_payments(payment_reference);
      `);

      console.log("✅ 'membership_payments' table created successfully.\n");
    } else {
      console.log("⏭️  'membership_payments' table already exists. Skipping...\n");
    }

    console.log("✅ Migration completed successfully!");
    console.log("\n📋 Summary:");
    console.log("   - memberships table");
    console.log("   - membership_products table");
    console.log("   - membership_subscriptions table");
    console.log("   - membership_payments table");
    console.log("\n✨ All membership tables are ready to use!");

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
createMembershipTables();
