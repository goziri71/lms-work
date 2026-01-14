/**
 * Migration: Add Donation System
 * Creates donations and donation_categories tables
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function addDonations() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Donation System");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    // Step 1: Create donation_categories table
    console.log("🔍 Step 1: Creating 'donation_categories' table...");

    const [categoriesExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'donation_categories'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (categoriesExists.exists) {
      console.log("   ⏭️  'donation_categories' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE donation_categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          icon VARCHAR(50),
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_donation_categories_name ON donation_categories(name);
        CREATE INDEX idx_donation_categories_active ON donation_categories(is_active);
      `);

      // Insert default categories
      await db.query(`
        INSERT INTO donation_categories (name, description, icon, is_active) VALUES
        ('Religious and Faith', 'Donations for religious and faith-based causes', '🙏', true),
        ('Social and Impact', 'Donations for social causes and community impact', '❤️', true),
        ('Education', 'Donations for educational initiatives', '📚', true),
        ('Health and Medicine', 'Donations for health and medical causes', '🏥', true),
        ('General', 'General donations', '💝', true)
        ON CONFLICT (name) DO NOTHING;
      `);

      console.log("   ✅ 'donation_categories' table created successfully.");
      console.log("   ✅ Default donation categories inserted.");
    }

    // Step 2: Create donations table
    console.log("\n🔍 Step 2: Creating 'donations' table...");

    const [donationsExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'donations'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (donationsExists.exists) {
      console.log("   ⏭️  'donations' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE donations (
          id SERIAL PRIMARY KEY,
          donor_id INTEGER,
          donor_name VARCHAR(255),
          donor_email VARCHAR(255),
          amount DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          category_id INTEGER,
          message TEXT,
          visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'anonymous')),
          payment_method VARCHAR(50),
          payment_reference VARCHAR(255),
          payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
          invoice_id INTEGER,
          donated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_donations_donor 
            FOREIGN KEY (donor_id) 
            REFERENCES students(id) 
            ON DELETE SET NULL,
          CONSTRAINT fk_donations_category 
            FOREIGN KEY (category_id) 
            REFERENCES donation_categories(id) 
            ON DELETE SET NULL,
          CONSTRAINT fk_donations_invoice 
            FOREIGN KEY (invoice_id) 
            REFERENCES invoices(id) 
            ON DELETE SET NULL
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_donations_donor ON donations(donor_id);
        CREATE INDEX idx_donations_category ON donations(category_id);
        CREATE INDEX idx_donations_visibility ON donations(visibility);
        CREATE INDEX idx_donations_payment_status ON donations(payment_status);
        CREATE INDEX idx_donations_donated_at ON donations(donated_at);
        CREATE INDEX idx_donations_invoice ON donations(invoice_id);
      `);

      console.log("   ✅ 'donations' table created successfully.");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update models index to export Donation and DonationCategory");
    console.log("   2. Create donation controller (public/private donations)");
    console.log("   3. Create donation wall endpoint (public donations only)");
    console.log("   4. Integrate with payment system and invoice generation\n");

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

addDonations();
