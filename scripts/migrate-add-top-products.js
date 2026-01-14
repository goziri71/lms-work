/**
 * Migration: Add Top Products Feature
 * Adds is_featured and popularity_score fields to all product tables
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function addTopProducts() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Top Products Feature");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    const tables = [
      { name: "courses", display: "courses" },
      { name: "ebooks", display: "ebooks" },
      { name: "digital_downloads", display: "digital_downloads" },
      { name: "communities", display: "communities" },
      { name: "memberships", display: "memberships" },
    ];

    for (const table of tables) {
      console.log(`🔍 Processing '${table.name}' table...`);

      // Check if table exists
      const [tableExists] = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = '${table.name}'
        ) as exists;`,
        { type: QueryTypes.SELECT }
      );

      if (!tableExists.exists) {
        console.log(`   ⏭️  '${table.name}' table does not exist. Skipping...`);
        continue;
      }

      // Check and add is_featured column
      const [featuredExists] = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = '${table.name}' 
          AND column_name = 'is_featured'
        ) as exists;`,
        { type: QueryTypes.SELECT }
      );

      if (featuredExists.exists) {
        console.log(`   ⏭️  'is_featured' column already exists in '${table.name}'. Skipping...`);
      } else {
        await db.query(`
          ALTER TABLE ${table.name}
          ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;
        `);
        await db.query(`
          CREATE INDEX idx_${table.name}_featured ON ${table.name}(is_featured);
        `);
        console.log(`   ✅ Added 'is_featured' column to '${table.name}'.`);
      }

      // Check and add featured_at column (timestamp when featured)
      const [featuredAtExists] = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = '${table.name}' 
          AND column_name = 'featured_at'
        ) as exists;`,
        { type: QueryTypes.SELECT }
      );

      if (featuredAtExists.exists) {
        console.log(`   ⏭️  'featured_at' column already exists in '${table.name}'. Skipping...`);
      } else {
        await db.query(`
          ALTER TABLE ${table.name}
          ADD COLUMN featured_at TIMESTAMP;
        `);
        console.log(`   ✅ Added 'featured_at' column to '${table.name}'.`);
      }

      // Check and add popularity_score column
      const [popularityExists] = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = '${table.name}' 
          AND column_name = 'popularity_score'
        ) as exists;`,
        { type: QueryTypes.SELECT }
      );

      if (popularityExists.exists) {
        console.log(`   ⏭️  'popularity_score' column already exists in '${table.name}'. Skipping...`);
      } else {
        await db.query(`
          ALTER TABLE ${table.name}
          ADD COLUMN popularity_score DECIMAL(10, 2) NOT NULL DEFAULT 0.0;
        `);
        await db.query(`
          CREATE INDEX idx_${table.name}_popularity ON ${table.name}(popularity_score DESC);
        `);
        console.log(`   ✅ Added 'popularity_score' column to '${table.name}'.`);
      }

      // Check and add sales_count if it doesn't exist (for courses, communities, memberships)
      if (["courses", "communities", "memberships"].includes(table.name)) {
        const [salesCountExists] = await db.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = '${table.name}' 
            AND column_name = 'sales_count'
          ) as exists;`,
          { type: QueryTypes.SELECT }
        );

        if (salesCountExists.exists) {
          console.log(`   ⏭️  'sales_count' column already exists in '${table.name}'. Skipping...`);
        } else {
          await db.query(`
            ALTER TABLE ${table.name}
            ADD COLUMN sales_count INTEGER NOT NULL DEFAULT 0;
          `);
          console.log(`   ✅ Added 'sales_count' column to '${table.name}'.`);
        }
      }

      console.log(`   ✅ '${table.name}' table updated successfully.\n`);
    }

    console.log("✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update product models to include new fields");
    console.log("   2. Create popularity calculation algorithm");
    console.log("   3. Create cron job for daily popularity score updates");
    console.log("   4. Create top/featured/trending product endpoints\n");

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

addTopProducts();
