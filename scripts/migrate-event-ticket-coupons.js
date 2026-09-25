/**
 * Event promo / coupon codes.
 *
 * Run: node scripts/migrate-event-ticket-coupons.js
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
    console.log("🎫 Event ticket coupons\n");

    if (!(await tableExists("event_ticket_coupons"))) {
      await db.query(`
        CREATE TABLE event_ticket_coupons (
          id SERIAL PRIMARY KEY,
          event_id INTEGER NOT NULL REFERENCES ticketed_events(id) ON DELETE CASCADE,
          code VARCHAR(64) NOT NULL,
          discount_type VARCHAR(16) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
          discount_value DECIMAL(10, 2) NOT NULL,
          max_uses INTEGER NULL,
          uses_count INTEGER NOT NULL DEFAULT 0,
          one_per_email BOOLEAN NOT NULL DEFAULT true,
          tier_ids JSONB NULL,
          starts_at TIMESTAMP NULL,
          ends_at TIMESTAMP NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (event_id, code)
        );
      `);
      console.log("✅ Created event_ticket_coupons");
      await db.query(
        `CREATE INDEX idx_event_ticket_coupons_event_id ON event_ticket_coupons(event_id);`
      );
    } else {
      console.log("⏭️  event_ticket_coupons already exists");
    }

    await addColumn(
      "event_ticket_orders",
      "coupon_id",
      "coupon_id INTEGER NULL REFERENCES event_ticket_coupons(id) ON DELETE SET NULL"
    );
    await addColumn(
      "event_ticket_orders",
      "coupon_code",
      "coupon_code VARCHAR(64) NULL"
    );
    await addColumn(
      "event_ticket_orders",
      "coupon_discount_amount",
      "coupon_discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0"
    );
    await addColumn(
      "event_ticket_orders",
      "coupon_consumed",
      "coupon_consumed BOOLEAN NOT NULL DEFAULT false"
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
