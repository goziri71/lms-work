/**
 * Migration: Add Sales Pages System
 * Creates product_sales_pages and sales_page_views tables
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function addSalesPages() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Sales Pages System");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    const dialect = db.getDialect();

    // Step 1: Create product_sales_pages table
    console.log("🔍 Step 1: Creating 'product_sales_pages' table...");

    const [pagesExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'product_sales_pages'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (pagesExists.exists) {
      console.log("   ⏭️  'product_sales_pages' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE product_sales_pages (
          id SERIAL PRIMARY KEY,
          product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('course', 'ebook', 'digital_download', 'community', 'membership')),
          product_id INTEGER NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          title VARCHAR(255) NOT NULL,
          hero_image_url TEXT,
          hero_video_url TEXT,
          content TEXT,
          features JSONB,
          testimonials JSONB,
          faq JSONB,
          call_to_action_text VARCHAR(200) DEFAULT 'Get Started Now',
          call_to_action_url TEXT,
          meta_title VARCHAR(255),
          meta_description TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
          views_count INTEGER NOT NULL DEFAULT 0,
          conversions_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_product_sales_page UNIQUE (product_type, product_id)
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_product_sales_pages_product ON product_sales_pages(product_type, product_id);
        CREATE INDEX idx_product_sales_pages_slug ON product_sales_pages(slug);
        CREATE INDEX idx_product_sales_pages_status ON product_sales_pages(status);
      `);

      console.log("   ✅ 'product_sales_pages' table created successfully.");
    }

    // Step 2: Create sales_page_views table
    console.log("\n🔍 Step 2: Creating 'sales_page_views' table...");

    const [viewsExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sales_page_views'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (viewsExists.exists) {
      console.log("   ⏭️  'sales_page_views' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE sales_page_views (
          id SERIAL PRIMARY KEY,
          sales_page_id INTEGER NOT NULL,
          user_id INTEGER,
          user_type VARCHAR(20) CHECK (user_type IN ('student', 'sole_tutor', 'organization', 'staff', 'admin')),
          ip_address VARCHAR(45),
          user_agent TEXT,
          referrer TEXT,
          converted BOOLEAN NOT NULL DEFAULT false,
          converted_at TIMESTAMP,
          viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_sales_page_views_sales_page 
            FOREIGN KEY (sales_page_id) 
            REFERENCES product_sales_pages(id) 
            ON DELETE CASCADE
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_sales_page_views_sales_page ON sales_page_views(sales_page_id);
        CREATE INDEX idx_sales_page_views_user ON sales_page_views(user_id);
        CREATE INDEX idx_sales_page_views_viewed_at ON sales_page_views(viewed_at);
        CREATE INDEX idx_sales_page_views_converted ON sales_page_views(converted);
      `);

      console.log("   ✅ 'sales_page_views' table created successfully.");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update models index to export ProductSalesPage and SalesPageView");
    console.log("   2. Create sales page builder controller (CRUD)");
    console.log("   3. Create public sales page route (/sales/:slug)");
    console.log("   4. Add analytics tracking for sales pages\n");

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

addSalesPages();
