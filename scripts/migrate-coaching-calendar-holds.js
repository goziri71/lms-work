/**
 * Calendar holds for accepted coaching bookings.
 * Run: node scripts/migrate-coaching-calendar-holds.js
 */

import dotenv from "dotenv";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

dotenv.config({ debug: false });

async function tableExists(name) {
  const [row] = await db.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = :name
    ) AS exists;`,
    { type: QueryTypes.SELECT, replacements: { name } }
  );
  return !!row?.exists;
}

async function run() {
  try {
    await db.authenticate();
    if (await tableExists("coaching_calendar_holds")) {
      console.log("⏭️  coaching_calendar_holds already exists");
      process.exit(0);
    }
    await db.query(`
      CREATE TABLE coaching_calendar_holds (
        id SERIAL PRIMARY KEY,
        tutor_id INTEGER NOT NULL,
        tutor_type VARCHAR(20) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
        booking_request_id INTEGER NOT NULL UNIQUE REFERENCES coaching_booking_requests(id) ON DELETE CASCADE,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
        availability_slot_id INTEGER NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_cch_tutor ON coaching_calendar_holds (tutor_id, tutor_type);
      CREATE INDEX idx_cch_status ON coaching_calendar_holds (status);
      CREATE INDEX idx_cch_start ON coaching_calendar_holds (start_time);
    `);
    console.log("✅ Created coaching_calendar_holds");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
