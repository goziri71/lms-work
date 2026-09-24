/**
 * Reminder email tracking on paid event orders.
 *
 * Run: node scripts/migrate-event-ticket-reminders.js
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
    console.log("✅ LMS Database connection established successfully.");
    console.log("🎫 Event ticket reminders\n");

    await addColumn(
      "event_ticket_orders",
      "reminder_24h_sent_at",
      "reminder_24h_sent_at TIMESTAMP NULL"
    );
    await addColumn(
      "event_ticket_orders",
      "reminder_soon_sent_at",
      "reminder_soon_sent_at TIMESTAMP NULL"
    );

    console.log("\n✅ Migration complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    if (error.original) {
      console.error("   Original error:", error.original.message);
    }
    process.exit(1);
  }
}

run();
