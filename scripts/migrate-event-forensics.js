/**
 * Event forensics: activity log + view_count on ticketed_events.
 * Run: node scripts/migrate-event-forensics.js
 */

import dotenv from "dotenv";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

dotenv.config({ debug: false });

async function exists(tableName, columnName = null) {
  if (columnName) {
    const [row] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = :tableName
          AND column_name = :columnName
      ) AS exists;`,
      { type: QueryTypes.SELECT, replacements: { tableName, columnName } }
    );
    return !!row?.exists;
  }
  const [row] = await db.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = :tableName
    ) AS exists;`,
    { type: QueryTypes.SELECT, replacements: { tableName } }
  );
  return !!row?.exists;
}

async function run() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");
    console.log("🔍 Event forensics\n");

    if (!(await exists("ticketed_events", "view_count"))) {
      await db.query(
        `ALTER TABLE ticketed_events ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;`
      );
      console.log("✅ ticketed_events.view_count");
    } else {
      console.log("⏭️  ticketed_events.view_count already exists");
    }

    if (await exists("event_activity_logs")) {
      console.log("⏭️  event_activity_logs already exists");
    } else {
      await db.query(`
        CREATE TABLE event_activity_logs (
          id SERIAL PRIMARY KEY,
          event_id INTEGER NOT NULL REFERENCES ticketed_events(id) ON DELETE CASCADE,
          action VARCHAR(64) NOT NULL,
          actor_type VARCHAR(32),
          actor_id INTEGER,
          order_id INTEGER,
          ticket_id INTEGER,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await db.query(`
        CREATE INDEX idx_event_activity_event_created
          ON event_activity_logs (event_id, created_at DESC);
        CREATE INDEX idx_event_activity_action
          ON event_activity_logs (event_id, action);
        CREATE INDEX idx_event_activity_order
          ON event_activity_logs (order_id);
      `);
      console.log("✅ event_activity_logs");
    }

    console.log("\n✅ Migration complete");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

run();
