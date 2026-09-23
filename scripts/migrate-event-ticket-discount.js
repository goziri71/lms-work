/**
 * Add discount fields to event_ticket_tiers (paid packages only).
 *
 * Run: node scripts/migrate-event-ticket-discount.js
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
    console.log("🎫 Event ticket: paid-ticket discounts\n");

    await addColumn(
      "event_ticket_tiers",
      "discount_type",
      "discount_type VARCHAR(16) NOT NULL DEFAULT 'none'"
    );
    await addColumn(
      "event_ticket_tiers",
      "discount_value",
      "discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0"
    );
    await addColumn(
      "event_ticket_tiers",
      "discount_starts_at",
      "discount_starts_at TIMESTAMP"
    );
    await addColumn(
      "event_ticket_tiers",
      "discount_ends_at",
      "discount_ends_at TIMESTAMP"
    );

    console.log("\n✅ Migration complete");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

run();
