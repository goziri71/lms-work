import { db } from "../src/database/database.js";

/**
 * Migration: Add image_url column to community_posts table
 * This column was added to the model but was missing from the initial table creation
 */

async function addImageUrlToCommunityPosts() {
  try {
    if (!db || !db.getDialect) {
      console.error("❌ Database connection not initialized. Please ensure connectDB() is called.");
      process.exit(1);
    }

    const dialect = db.getDialect();

    console.log("📦 Starting migration: Add image_url to community_posts");
    console.log(`Database dialect: ${dialect}`);

    if (dialect === "postgres") {
      console.log("\n🔍 Adding 'image_url' column to 'community_posts' table...");
      
      await db.query(`
        ALTER TABLE community_posts
        ADD COLUMN IF NOT EXISTS image_url TEXT;
      `);

      console.log("✅ 'image_url' column added successfully to 'community_posts' table");

    } else if (dialect === "mysql" || dialect === "mariadb") {
      console.log("\n🔍 Adding 'image_url' column to 'community_posts' table...");
      
      await db.query(`
        ALTER TABLE community_posts
        ADD COLUMN IF NOT EXISTS image_url TEXT;
      `);

      console.log("✅ 'image_url' column added successfully to 'community_posts' table");
    } else {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
addImageUrlToCommunityPosts();

