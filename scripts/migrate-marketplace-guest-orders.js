/**
 * Guest checkout orders (courses + digital products).
 *
 * Run: node scripts/migrate-marketplace-guest-orders.js
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
    console.log("✅ Database connected.");
    if (await tableExists("marketplace_guest_orders")) {
      console.log("⏭️  marketplace_guest_orders already exists");
      process.exit(0);
    }

    await db.query(`
      CREATE TABLE marketplace_guest_orders (
        id SERIAL PRIMARY KEY,
        product_type VARCHAR(32) NOT NULL CHECK (product_type IN ('course', 'digital_download')),
        product_id INTEGER NOT NULL,
        product_title VARCHAR(500) NULL,
        buyer_email VARCHAR(255) NOT NULL,
        buyer_name VARCHAR(255) NOT NULL,
        buyer_phone VARCHAR(32) NULL,
        student_id INTEGER NULL REFERENCES students(id) ON DELETE SET NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
        owner_type VARCHAR(32) NULL,
        owner_id INTEGER NULL,
        access_token VARCHAR(128) NULL UNIQUE,
        payment_method VARCHAR(32) NULL,
        transaction_ref VARCHAR(255) NULL UNIQUE,
        flutterwave_transaction_id VARCHAR(100) NULL,
        idempotency_key VARCHAR(64) NULL UNIQUE,
        reservation_expires_at TIMESTAMP NULL,
        commission_rate DECIMAL(5, 2) NULL,
        platform_fee DECIMAL(10, 2) NULL,
        tutor_earnings DECIMAL(10, 2) NULL,
        entitlement_created BOOLEAN NOT NULL DEFAULT false,
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await db.query(
      `CREATE INDEX idx_mgo_buyer_email ON marketplace_guest_orders(buyer_email);`
    );
    await db.query(
      `CREATE INDEX idx_mgo_product ON marketplace_guest_orders(product_type, product_id);`
    );
    console.log("✅ marketplace_guest_orders created");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

run();
