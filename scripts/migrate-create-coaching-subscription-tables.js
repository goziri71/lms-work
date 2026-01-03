import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to create coaching and subscription system tables
 * 
 * This script creates:
 * 1. tutor_subscriptions - Subscription tiers for tutors
 * 2. coaching_sessions - Coaching session records
 * 3. coaching_session_participants - Students invited to sessions
 * 4. coaching_hours_balance - Tutor coaching hours balance
 * 5. coaching_hours_purchases - Purchase history for coaching hours
 * 6. coaching_settings - WPU admin settings (price per hour)
 * 
 * Run with: node scripts/migrate-create-coaching-subscription-tables.js
 */

async function createCoachingSubscriptionTables() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Coaching & Subscription System\n");

    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    // Step 1: Create tutor_subscriptions table
    console.log("🔍 Step 1: Creating 'tutor_subscriptions' table...");
    const [subscriptionsTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tutor_subscriptions'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!subscriptionsTableExists.exists) {
      await db.query(`
        CREATE TABLE tutor_subscriptions (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL,
          tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
          subscription_tier VARCHAR(50) NOT NULL CHECK (subscription_tier IN ('free', 'basic', 'professional', 'expert', 'grand_master')),
          status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
          start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          end_date TIMESTAMP,
          auto_renew BOOLEAN DEFAULT false,
          courses_limit INTEGER,
          communities_limit INTEGER,
          digital_downloads_limit INTEGER,
          memberships_limit INTEGER,
          unlimited_coaching BOOLEAN DEFAULT false,
          commission_rate DECIMAL(5, 2) DEFAULT 10.0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Create partial unique index for active subscriptions
      await db.query(`
        CREATE UNIQUE INDEX unique_active_subscription 
        ON tutor_subscriptions (tutor_id, tutor_type) 
        WHERE status = 'active';
      `);
      console.log("✅ Created 'tutor_subscriptions' table");
    } else {
      console.log("⚠️  'tutor_subscriptions' table already exists. Skipping...");
    }

    // Step 2: Create coaching_sessions table
    console.log("\n🔍 Step 2: Creating 'coaching_sessions' table...");
    const [sessionsTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'coaching_sessions'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!sessionsTableExists.exists) {
      await db.query(`
        CREATE TABLE coaching_sessions (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL,
          tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP NOT NULL,
          duration_minutes INTEGER NOT NULL,
          stream_call_id VARCHAR(255) UNIQUE,
          view_link TEXT,
          status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
          hours_reserved DECIMAL(10, 2) DEFAULT 0.0,
          hours_used DECIMAL(10, 2) DEFAULT 0.0,
          student_count INTEGER DEFAULT 0,
          actual_start_time TIMESTAMP,
          actual_end_time TIMESTAMP,
          warning_sent_10min BOOLEAN DEFAULT false,
          warning_sent_5min BOOLEAN DEFAULT false,
          warning_sent_low_balance BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("✅ Created 'coaching_sessions' table");
    } else {
      console.log("⚠️  'coaching_sessions' table already exists. Skipping...");
    }

    // Step 3: Create coaching_session_participants table
    console.log("\n🔍 Step 3: Creating 'coaching_session_participants' table...");
    const [participantsTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'coaching_session_participants'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!participantsTableExists.exists) {
      await db.query(`
        CREATE TABLE coaching_session_participants (
          id SERIAL PRIMARY KEY,
          session_id INTEGER NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          joined_at TIMESTAMP,
          left_at TIMESTAMP,
          email_sent BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_participant UNIQUE (session_id, student_id)
        );
      `);
      console.log("✅ Created 'coaching_session_participants' table");
    } else {
      console.log("⚠️  'coaching_session_participants' table already exists. Skipping...");
    }

    // Step 4: Create coaching_hours_balance table
    console.log("\n🔍 Step 4: Creating 'coaching_hours_balance' table...");
    const [balanceTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'coaching_hours_balance'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!balanceTableExists.exists) {
      await db.query(`
        CREATE TABLE coaching_hours_balance (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL,
          tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
          hours_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.0,
          total_purchased DECIMAL(10, 2) DEFAULT 0.0,
          total_used DECIMAL(10, 2) DEFAULT 0.0,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_tutor_balance UNIQUE (tutor_id, tutor_type)
        );
      `);
      console.log("✅ Created 'coaching_hours_balance' table");
    } else {
      console.log("⚠️  'coaching_hours_balance' table already exists. Skipping...");
    }

    // Step 5: Create coaching_hours_purchases table
    console.log("\n🔍 Step 5: Creating 'coaching_hours_purchases' table...");
    const [purchasesTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'coaching_hours_purchases'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!purchasesTableExists.exists) {
      await db.query(`
        CREATE TABLE coaching_hours_purchases (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL,
          tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
          hours_purchased DECIMAL(10, 2) NOT NULL,
          price_per_hour DECIMAL(10, 2) NOT NULL,
          total_amount DECIMAL(10, 2) NOT NULL,
          transaction_ref VARCHAR(255) UNIQUE,
          payment_method VARCHAR(50) DEFAULT 'wallet',
          currency VARCHAR(10) DEFAULT 'NGN',
          status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
          purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("✅ Created 'coaching_hours_purchases' table");
    } else {
      console.log("⚠️  'coaching_hours_purchases' table already exists. Skipping...");
    }

    // Step 6: Create coaching_settings table
    console.log("\n🔍 Step 6: Creating 'coaching_settings' table...");
    const [settingsTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'coaching_settings'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!settingsTableExists.exists) {
      await db.query(`
        CREATE TABLE coaching_settings (
          id SERIAL PRIMARY KEY,
          price_per_hour DECIMAL(10, 2) NOT NULL DEFAULT 10.0,
          currency VARCHAR(10) DEFAULT 'NGN',
          default_duration_minutes INTEGER DEFAULT 60,
          warning_threshold_minutes INTEGER DEFAULT 10,
          auto_end_enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Insert default settings
      await db.query(`
        INSERT INTO coaching_settings (price_per_hour, currency, default_duration_minutes, warning_threshold_minutes, auto_end_enabled)
        VALUES (10.0, 'NGN', 60, 10, true);
      `);
      console.log("✅ Created 'coaching_settings' table with default values");
    } else {
      console.log("⚠️  'coaching_settings' table already exists. Skipping...");
    }

    // Step 7: Create indexes for performance
    console.log("\n🔍 Step 7: Creating indexes...");
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_tutor_subscriptions_tutor ON tutor_subscriptions(tutor_id, tutor_type);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_coaching_sessions_tutor ON coaching_sessions(tutor_id, tutor_type);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_coaching_sessions_status ON coaching_sessions(status);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_coaching_sessions_start_time ON coaching_sessions(start_time);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_coaching_participants_session ON coaching_session_participants(session_id);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_coaching_participants_student ON coaching_session_participants(student_id);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_coaching_balance_tutor ON coaching_hours_balance(tutor_id, tutor_type);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_coaching_purchases_tutor ON coaching_hours_purchases(tutor_id, tutor_type);`);
      console.log("✅ Created indexes");
    } catch (error) {
      console.log("⚠️  Some indexes may already exist. Continuing...");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📋 Next steps:");
    console.log("   1. Set up default subscriptions for existing tutors (optional)");
    console.log("   2. Configure coaching price per hour via admin endpoint");
    console.log("   3. Test subscription and coaching endpoints");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

createCoachingSubscriptionTables();

