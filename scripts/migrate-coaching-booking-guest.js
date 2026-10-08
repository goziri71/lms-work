/**
 * Guest 1-on-1 coaching booking + public pay link fields.
 * Run: node scripts/migrate-coaching-booking-guest.js
 */

import dotenv from "dotenv";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

dotenv.config({ debug: false });

async function columnExists(tableName, columnName) {
  const [row] = await db.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = :tableName
        AND column_name = :columnName
    ) AS exists;`,
    {
      type: QueryTypes.SELECT,
      replacements: { tableName, columnName },
    }
  );
  return !!row?.exists;
}

async function addColumn(table, column, ddl) {
  if (await columnExists(table, column)) {
    console.log(`⏭️  ${table}.${column} already exists`);
    return;
  }
  await db.query(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
  console.log(`✅ Added ${table}.${column}`);
}

async function run() {
  try {
    await db.authenticate();
    const table = "coaching_booking_requests";

    await db.query(
      `ALTER TABLE ${table} ALTER COLUMN student_id DROP NOT NULL;`
    ).catch(() => {
      console.log("⏭️  student_id already nullable or alter skipped");
    });

    await addColumn(table, "guest_email", "guest_email VARCHAR(255) NULL");
    await addColumn(table, "guest_name", "guest_name VARCHAR(255) NULL");
    await addColumn(table, "guest_phone", "guest_phone VARCHAR(50) NULL");
    await addColumn(table, "access_token", "access_token VARCHAR(128) NULL UNIQUE");
    await addColumn(
      table,
      "transaction_ref",
      "transaction_ref VARCHAR(255) NULL"
    );
    await addColumn(
      table,
      "payment_method",
      "payment_method VARCHAR(50) NULL"
    );
    await addColumn(table, "paid_at", "paid_at TIMESTAMP NULL");

    if (!(await columnExists("coaching_session_purchases", "guest_email"))) {
      await db.query(
        `ALTER TABLE coaching_session_purchases ALTER COLUMN student_id DROP NOT NULL;`
      ).catch(() => {});
      await addColumn(
        "coaching_session_purchases",
        "guest_email",
        "guest_email VARCHAR(255) NULL"
      );
    }

    if (!(await columnExists("coaching_session_participants", "guest_email"))) {
      await db.query(
        `ALTER TABLE coaching_session_participants ALTER COLUMN student_id DROP NOT NULL;`
      ).catch(() => {});
      await addColumn(
        "coaching_session_participants",
        "guest_email",
        "guest_email VARCHAR(255) NULL"
      );
    }

    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
