import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Adds tutor payout transfer PIN + email OTP columns to sole_tutors and organizations.
 * Run: node scripts/migrate-add-tutor-transfer-pin.js
 */

const TABLES = ["sole_tutors", "organizations"];

const COLUMNS = [
  {
    name: "transfer_pin_hash",
    sql: "VARCHAR(255) NULL",
    comment: "bcrypt hash of 4–6 digit transfer PIN",
  },
  {
    name: "transfer_pin_set_at",
    sql: "TIMESTAMP WITH TIME ZONE NULL",
    comment: "when PIN was last set",
  },
  {
    name: "transfer_pin_failed_attempts",
    sql: "INTEGER NOT NULL DEFAULT 0",
    comment: "failed PIN attempts (payout)",
  },
  {
    name: "transfer_pin_locked_until",
    sql: "TIMESTAMP WITH TIME ZONE NULL",
    comment: "payout PIN locked until this time",
  },
  {
    name: "transfer_pin_otp_hash",
    sql: "VARCHAR(128) NULL",
    comment: "HMAC digest for pending email OTP",
  },
  {
    name: "transfer_pin_otp_expires_at",
    sql: "TIMESTAMP WITH TIME ZONE NULL",
    comment: "OTP expiry",
  },
  {
    name: "transfer_pin_otp_purpose",
    sql: "VARCHAR(20) NULL",
    comment: "setup | change | reset",
  },
  {
    name: "transfer_pin_otp_last_sent_at",
    sql: "TIMESTAMP WITH TIME ZONE NULL",
    comment: "throttle resend",
  },
  {
    name: "transfer_pin_otp_failed_attempts",
    sql: "INTEGER NOT NULL DEFAULT 0",
    comment: "failed OTP confirmations",
  },
];

async function migrate() {
  await db.authenticate();
  console.log("✅ DB connected\n📦 migrate-add-tutor-transfer-pin\n");

  for (const table of TABLES) {
    for (const col of COLUMNS) {
      const found = await db.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = :table AND column_name = :col`,
        { replacements: { table, col: col.name }, type: QueryTypes.SELECT }
      );
      if (Array.isArray(found) && found.length > 0) {
        console.log(`⏭️  ${table}.${col.name} exists`);
        continue;
      }
      await db.query(
        `ALTER TABLE "${table}" ADD COLUMN "${col.name}" ${col.sql}`
      );
      console.log(`✅ ${table}.${col.name} added (${col.comment})`);
    }
  }

  console.log("\n✅ Done.");
  await db.close();
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
