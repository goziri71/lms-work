import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to add pricing and course-like fields to coaching sessions
 * 
 * This script:
 * 1. Adds pricing fields to coaching_sessions (pricing_type, price, currency)
 * 2. Adds course-like fields (category, image_url, tags)
 * 3. Creates coaching_session_purchases table
 * 
 * Run with: node scripts/migrate-add-coaching-pricing-fields.js
 */

async function addCoachingPricingFields() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Coaching Pricing & Course-like Fields\n");

    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    // Step 1: Check if coaching_sessions table exists
    console.log("🔍 Step 1: Checking 'coaching_sessions' table...");
    const [sessionsTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'coaching_sessions'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!sessionsTableExists.exists) {
      console.log("❌ 'coaching_sessions' table does not exist. Please run migrate-create-coaching-subscription-tables.js first.");
      process.exit(1);
    }

    // Step 2: Add pricing fields to coaching_sessions
    console.log("\n🔍 Step 2: Adding pricing fields to 'coaching_sessions' table...");
    try {
      await db.query(`
        ALTER TABLE coaching_sessions
        ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(20) DEFAULT 'free' CHECK (pricing_type IN ('free', 'paid')),
        ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'NGN';
      `);
      console.log("✅ Added pricing fields (pricing_type, price, currency)");
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log("⚠️  Pricing fields may already exist. Continuing...");
      } else {
        throw error;
      }
    }

    // Step 3: Add course-like fields to coaching_sessions
    console.log("\n🔍 Step 3: Adding course-like fields to 'coaching_sessions' table...");
    try {
      await db.query(`
        ALTER TABLE coaching_sessions
        ADD COLUMN IF NOT EXISTS category VARCHAR(100),
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS tags JSONB;
      `);
      console.log("✅ Added course-like fields (category, image_url, tags)");
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log("⚠️  Course-like fields may already exist. Continuing...");
      } else {
        throw error;
      }
    }

    // Step 4: Create coaching_session_purchases table
    console.log("\n🔍 Step 4: Creating 'coaching_session_purchases' table...");
    const [purchasesTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'coaching_session_purchases'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!purchasesTableExists.exists) {
      await db.query(`
        CREATE TABLE coaching_session_purchases (
          id SERIAL PRIMARY KEY,
          session_id INTEGER NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          price_paid DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          commission_rate DECIMAL(5, 2),
          wsp_commission DECIMAL(10, 2),
          tutor_earnings DECIMAL(10, 2),
          transaction_ref VARCHAR(255) UNIQUE,
          payment_method VARCHAR(50) DEFAULT 'wallet',
          purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_session_purchase UNIQUE (session_id, student_id)
        );
      `);
      console.log("✅ Created 'coaching_session_purchases' table");
    } else {
      console.log("⚠️  'coaching_session_purchases' table already exists. Skipping...");
    }

    // Step 5: Add commission_rate field to coaching_sessions (separate from course commission)
    console.log("\n🔍 Step 5: Adding commission_rate field to 'coaching_sessions' table...");
    try {
      await db.query(`
        ALTER TABLE coaching_sessions
        ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 15.0;
      `);
      console.log("✅ Added commission_rate field");
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log("⚠️  commission_rate field may already exist. Continuing...");
      } else {
        throw error;
      }
    }

    // Step 6: Create indexes
    console.log("\n🔍 Step 6: Creating indexes...");
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_coaching_purchases_session ON coaching_session_purchases(session_id);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_coaching_purchases_student ON coaching_session_purchases(student_id);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_coaching_sessions_pricing ON coaching_sessions(pricing_type, price);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_coaching_sessions_category ON coaching_sessions(category);`);
      console.log("✅ Created indexes");
    } catch (error) {
      console.log("⚠️  Some indexes may already exist. Continuing...");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📋 Next steps:");
    console.log("   1. Update CoachingSession model with new fields");
    console.log("   2. Create CoachingSessionPurchase model");
    console.log("   3. Update controllers to handle pricing");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

addCoachingPricingFields();

