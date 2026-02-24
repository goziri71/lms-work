import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to create hybrid coaching booking tables.
 *
 * Creates:
 * 1) tutor_coaching_profiles
 * 2) tutor_availability
 * 3) coaching_booking_requests
 *
 * Run with:
 *   node scripts/migrate-create-hybrid-coaching-tables.js
 */

async function tableExists(tableName) {
  const result = await db.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = :tableName
    ) AS exists;`,
    {
      type: QueryTypes.SELECT,
      replacements: { tableName },
    }
  );
  return !!result?.[0]?.exists;
}

async function createTutorCoachingProfiles() {
  console.log("\n🔍 Step 1: Creating 'tutor_coaching_profiles' table...");
  const exists = await tableExists("tutor_coaching_profiles");
  if (exists) {
    console.log("⚠️  'tutor_coaching_profiles' already exists. Skipping...");
    return;
  }

  await db.query(`
    CREATE TABLE tutor_coaching_profiles (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL,
      tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
      hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.0,
      currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      bio TEXT,
      specializations JSONB,
      is_accepting_bookings BOOLEAN NOT NULL DEFAULT true,
      min_duration_minutes INTEGER NOT NULL DEFAULT 30,
      max_duration_minutes INTEGER NOT NULL DEFAULT 180,
      timezone VARCHAR(50) DEFAULT 'Africa/Lagos',
      total_sessions_completed INTEGER NOT NULL DEFAULT 0,
      average_rating DECIMAL(3, 2),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_tutor_coaching_profile
    ON tutor_coaching_profiles (tutor_id, tutor_type);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tutor_coaching_profiles_accepting
    ON tutor_coaching_profiles (is_accepting_bookings);
  `);

  console.log("✅ Created 'tutor_coaching_profiles'");
}

async function createTutorAvailability() {
  console.log("\n🔍 Step 2: Creating 'tutor_availability' table...");
  const exists = await tableExists("tutor_availability");
  if (exists) {
    console.log("⚠️  'tutor_availability' already exists. Skipping...");
    return;
  }

  await db.query(`
    CREATE TABLE tutor_availability (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL,
      tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
      is_recurring BOOLEAN NOT NULL DEFAULT true,
      day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
      specific_date DATE,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      timezone VARCHAR(50) NOT NULL DEFAULT 'Africa/Lagos',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tutor_availability_tutor
    ON tutor_availability (tutor_id, tutor_type);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tutor_availability_recurring
    ON tutor_availability (is_recurring, day_of_week);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tutor_availability_specific_date
    ON tutor_availability (specific_date);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tutor_availability_active
    ON tutor_availability (is_active);
  `);

  console.log("✅ Created 'tutor_availability'");
}

async function createCoachingBookingRequests() {
  console.log("\n🔍 Step 3: Creating 'coaching_booking_requests' table...");
  const exists = await tableExists("coaching_booking_requests");
  if (exists) {
    console.log("⚠️  'coaching_booking_requests' already exists. Skipping...");
    return;
  }

  await db.query(`
    CREATE TABLE coaching_booking_requests (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      tutor_id INTEGER NOT NULL,
      tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
      topic VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100) CHECK (
        category IN (
          'Business & Management',
          'Technology & Data',
          'Engineering & Physical Science',
          'Health & Medicine',
          'Arts & Humanities',
          'Personal Development & Education'
        )
      ),
      proposed_start_time TIMESTAMP NOT NULL,
      proposed_end_time TIMESTAMP NOT NULL,
      proposed_duration_minutes INTEGER NOT NULL,
      is_from_availability BOOLEAN NOT NULL DEFAULT false,
      counter_proposed_start_time TIMESTAMP,
      counter_proposed_end_time TIMESTAMP,
      counter_proposed_duration_minutes INTEGER,
      status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'counter_proposed', 'accepted', 'declined', 'expired', 'cancelled')
      ),
      accepted_by VARCHAR(20) CHECK (accepted_by IN ('tutor', 'student')),
      hourly_rate DECIMAL(10, 2) NOT NULL,
      estimated_price DECIMAL(10, 2) NOT NULL,
      final_price DECIMAL(10, 2),
      currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      student_note TEXT,
      tutor_note TEXT,
      session_id INTEGER,
      accepted_at TIMESTAMP,
      declined_at TIMESTAMP,
      cancelled_at TIMESTAMP,
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_coaching_booking_requests_student
    ON coaching_booking_requests (student_id);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_coaching_booking_requests_tutor
    ON coaching_booking_requests (tutor_id, tutor_type);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_coaching_booking_requests_status
    ON coaching_booking_requests (status);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_coaching_booking_requests_proposed_start
    ON coaching_booking_requests (proposed_start_time);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_coaching_booking_requests_session
    ON coaching_booking_requests (session_id);
  `);

  console.log("✅ Created 'coaching_booking_requests'");
}

async function runMigration() {
  try {
    await db.authenticate();
    console.log("✅ Database connection established.");
    console.log("📦 Starting migration: Hybrid Coaching Booking tables");
    console.log(`Database dialect: ${db.getDialect()}`);

    await createTutorCoachingProfiles();
    await createTutorAvailability();
    await createCoachingBookingRequests();

    console.log("\n✅ Migration completed successfully.");
    console.log("\nRun test endpoints:");
    console.log("  GET /api/marketplace/tutor/coaching/profile");
    console.log("  GET /api/marketplace/tutor/coaching/availability");
    console.log("  GET /api/marketplace/tutor/coaching/booking-requests");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    process.exit(1);
  }
}

runMigration();

