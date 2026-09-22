/**
 * Add requires_approval to ticketed_events,
 * pending_approval / rejected order statuses,
 * and holder_names on event_ticket_orders.
 *
 * Run: node scripts/migrate-event-ticket-approval.js
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

async function updateOrderStatusCheck() {
  // Original migration used VARCHAR + CHECK; recreate to allow new statuses
  const constraints = await db.query(
    `SELECT conname
     FROM pg_constraint
     WHERE conrelid = 'event_ticket_orders'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%';`,
    { type: QueryTypes.SELECT }
  );

  for (const row of constraints) {
    await db.query(
      `ALTER TABLE event_ticket_orders DROP CONSTRAINT IF EXISTS "${row.conname}";`
    );
    console.log(`🗑️  Dropped check ${row.conname}`);
  }

  await db.query(`
    ALTER TABLE event_ticket_orders
    ADD CONSTRAINT event_ticket_orders_status_check
    CHECK (status IN (
      'pending',
      'pending_approval',
      'paid',
      'failed',
      'cancelled',
      'refunded',
      'rejected'
    ));
  `);
  console.log("✅ Updated event_ticket_orders status CHECK");
}

async function run() {
  try {
    // LMS only — skip library DB / Mongo (not needed for this migration)
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");

    console.log("🎫 Event ticket: approval mode\n");

    await addColumn(
      "ticketed_events",
      "requires_approval",
      "requires_approval BOOLEAN NOT NULL DEFAULT FALSE"
    );

    await addColumn(
      "event_ticket_orders",
      "holder_names",
      "holder_names JSONB"
    );

    await addColumn(
      "event_ticket_orders",
      "rejection_reason",
      "rejection_reason TEXT"
    );

    // Widen status column if needed (pending_approval = 16 chars)
    await db.query(`
      ALTER TABLE event_ticket_orders
      ALTER COLUMN status TYPE VARCHAR(32);
    `);
    console.log("✅ event_ticket_orders.status → VARCHAR(32)");

    await updateOrderStatusCheck();

    console.log("\n✅ Migration complete");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

run();
