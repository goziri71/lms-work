/**
 * Migration: Add Category and Intro Video to Communities
 * Adds category field (if not exists) and intro_video_url field to communities table
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function addCommunityCategoryIntro() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Community Category and Intro Video");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    // Step 1: Verify category column exists (it should already exist)
    console.log("🔍 Step 1: Verifying 'category' column in 'communities' table...");

    const [categoryExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'communities' 
        AND column_name = 'category'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (categoryExists.exists) {
      console.log("   ✅ 'category' column already exists.");
    } else {
      await db.query(`
        ALTER TABLE communities
        ADD COLUMN category VARCHAR(100);
      `);
      console.log("   ✅ Added 'category' column to 'communities'.");
    }

    // Step 2: Add intro_video_url column
    console.log("\n🔍 Step 2: Adding 'intro_video_url' column to 'communities' table...");

    const [introVideoExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'communities' 
        AND column_name = 'intro_video_url'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (introVideoExists.exists) {
      console.log("   ⏭️  'intro_video_url' column already exists. Skipping...");
    } else {
      await db.query(`
        ALTER TABLE communities
        ADD COLUMN intro_video_url TEXT;
      `);

      console.log("   ✅ Added 'intro_video_url' column to 'communities'.");
    }

    // Step 3: Add intro_video_thumbnail_url (optional thumbnail for video)
    console.log("\n🔍 Step 3: Adding 'intro_video_thumbnail_url' column to 'communities' table...");

    const [thumbnailExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'communities' 
        AND column_name = 'intro_video_thumbnail_url'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (thumbnailExists.exists) {
      console.log("   ⏭️  'intro_video_thumbnail_url' column already exists. Skipping...");
    } else {
      await db.query(`
        ALTER TABLE communities
        ADD COLUMN intro_video_thumbnail_url TEXT;
      `);

      console.log("   ✅ Added 'intro_video_thumbnail_url' column to 'communities'.");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update Community model to include intro_video_url fields");
    console.log("   2. Update community controller for video upload/embed");
    console.log("   3. Add video upload middleware if needed\n");

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

addCommunityCategoryIntro();
