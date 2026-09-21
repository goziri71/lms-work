/**
 * Add video_url + sales_open to ticketed_events,
 * and benefits (JSONB) to event_ticket_tiers.
 *
 * Pricing remains creator-defined via tier.price (no fixed platform price).
 *
 * Run: node scripts/migrate-event-ticket-video-benefits-sales.js
 */

import dotenv from "dotenv";
import { connectDB, db } from "../src/database/database.js";
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
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("🎫 Event ticket: video / benefits / sales_open\n");

    await addColumn(
      "ticketed_events",
      "video_url",
      "video_url TEXT"
    );
    await addColumn(
      "ticketed_events",
      "sales_open",
      "sales_open BOOLEAN NOT NULL DEFAULT TRUE"
    );
    await addColumn(
      "event_ticket_tiers",
      "benefits",
      "benefits JSONB NOT NULL DEFAULT '[]'::jsonb"
    );

    console.log("\n✅ Migration complete");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

run();
