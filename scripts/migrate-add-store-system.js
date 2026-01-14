/**
 * Migration: Add Store System (Guest Cart)
 * Creates store_carts and store_cart_items tables
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function addStoreSystem() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Store System (Guest Cart)");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    const dialect = db.getDialect();

    // Step 1: Create store_carts table
    console.log("🔍 Step 1: Creating 'store_carts' table...");

    const [cartsExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'store_carts'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (cartsExists.exists) {
      console.log("   ⏭️  'store_carts' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE store_carts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          session_id VARCHAR(255) UNIQUE,
          expires_at TIMESTAMP,
          status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'converted', 'expired')),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT check_cart_owner CHECK (
            (user_id IS NOT NULL AND session_id IS NULL) OR
            (user_id IS NULL AND session_id IS NOT NULL)
          )
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_store_carts_user ON store_carts(user_id);
        CREATE INDEX idx_store_carts_session ON store_carts(session_id);
        CREATE INDEX idx_store_carts_status ON store_carts(status);
        CREATE INDEX idx_store_carts_expires ON store_carts(expires_at);
      `);

      console.log("   ✅ 'store_carts' table created successfully.");
    }

    // Step 2: Create store_cart_items table
    console.log("\n🔍 Step 2: Creating 'store_cart_items' table...");

    const [itemsExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'store_cart_items'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (itemsExists.exists) {
      console.log("   ⏭️  'store_cart_items' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE store_cart_items (
          id SERIAL PRIMARY KEY,
          cart_id INTEGER NOT NULL,
          product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('course', 'ebook', 'digital_download', 'community', 'membership')),
          product_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          price DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_cart_product UNIQUE (cart_id, product_type, product_id),
          CONSTRAINT fk_store_cart_items_cart 
            FOREIGN KEY (cart_id) 
            REFERENCES store_carts(id) 
            ON DELETE CASCADE
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_store_cart_items_cart ON store_cart_items(cart_id);
        CREATE INDEX idx_store_cart_items_product ON store_cart_items(product_type, product_id);
      `);

      console.log("   ✅ 'store_cart_items' table created successfully.");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update models index to export StoreCart and StoreCartItem");
    console.log("   2. Create cart management controller (add, remove, update, get)");
    console.log("   3. Create public store browsing endpoints (no auth)");
    console.log("   4. Implement cart merge on login (guest → user cart)");
    console.log("   5. Create checkout flow (redirect to login/register)");
    console.log("   6. Create cron job for expired cart cleanup (2 days)\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    process.exit(1);
  }
}

addStoreSystem();
