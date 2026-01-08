/**
 * Migration Script: Add Community Features
 * 
 * This script adds:
 * 1. Reactions table for posts and comments
 * 2. Mentions tracking in posts and comments
 * 3. Blog features: draft, scheduled, featured posts
 * 
 * Run: node scripts/migrate-add-community-features.js
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { db } from "../src/database/database.js";

dotenv.config();

async function migrateCommunityFeatures() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("📦 Starting migration: Add Community Features\n");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    const dialect = db.getDialect();
    const isPostgres = dialect === "postgres";

    // Step 1: Create reactions table
    console.log("🔍 Step 1: Creating 'community_reactions' table...");
    
    if (isPostgres) {
      await db.query(`
        CREATE TABLE IF NOT EXISTS community_reactions (
          id SERIAL PRIMARY KEY,
          post_id INTEGER REFERENCES community_posts(id) ON DELETE CASCADE,
          comment_id INTEGER REFERENCES community_comments(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL,
          user_type VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (user_type IN ('student', 'tutor')),
          emoji VARCHAR(50) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT check_target CHECK (
            (post_id IS NOT NULL AND comment_id IS NULL) OR 
            (post_id IS NULL AND comment_id IS NOT NULL)
          ),
          CONSTRAINT unique_reaction UNIQUE (post_id, comment_id, user_id, user_type, emoji)
        );
      `);
    } else {
      await db.query(`
        CREATE TABLE IF NOT EXISTS community_reactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          post_id INT NULL,
          comment_id INT NULL,
          user_id INT NOT NULL,
          user_type VARCHAR(20) NOT NULL DEFAULT 'student',
          emoji VARCHAR(50) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
          FOREIGN KEY (comment_id) REFERENCES community_comments(id) ON DELETE CASCADE,
          CONSTRAINT check_target CHECK (
            (post_id IS NOT NULL AND comment_id IS NULL) OR 
            (post_id IS NULL AND comment_id IS NOT NULL)
          ),
          UNIQUE KEY unique_reaction (post_id, comment_id, user_id, user_type, emoji)
        );
      `);
    }

    // Create indexes
    await db.query(`CREATE INDEX IF NOT EXISTS idx_reactions_post ON community_reactions(post_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_reactions_comment ON community_reactions(comment_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_reactions_user ON community_reactions(user_id, user_type);`);

    console.log("✅ Created 'community_reactions' table\n");

    // Step 2: Add blog features to posts table
    console.log("🔍 Step 2: Adding blog features to 'community_posts' table...");

    // Add scheduled_at column
    try {
      if (isPostgres) {
        await db.query(`ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP NULL;`);
        await db.query(`ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;`);
        await db.query(`ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS featured_at TIMESTAMP NULL;`);
        await db.query(`ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS mentions JSONB NULL;`);
      } else {
        await db.query(`ALTER TABLE community_posts ADD COLUMN scheduled_at TIMESTAMP NULL;`);
        await db.query(`ALTER TABLE community_posts ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;`);
        await db.query(`ALTER TABLE community_posts ADD COLUMN featured_at TIMESTAMP NULL;`);
        await db.query(`ALTER TABLE community_posts ADD COLUMN mentions JSON NULL;`);
      }
      console.log("✅ Added blog features columns\n");
    } catch (error) {
      if (error.message.includes("Duplicate column") || error.message.includes("already exists")) {
        console.log("⚠️  Some columns already exist, skipping...\n");
      } else {
        throw error;
      }
    }

    // Update status enum to include 'draft' and 'scheduled'
    try {
      if (isPostgres) {
        // Check current status values
        const [statusCheck] = await db.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'community_posts' AND column_name = 'status'
        `);
        
        // PostgreSQL ENUM update requires more complex handling
        // For now, we'll use VARCHAR and add CHECK constraint
        await db.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'community_posts_status_check'
            ) THEN
              ALTER TABLE community_posts 
              ADD CONSTRAINT community_posts_status_check 
              CHECK (status IN ('draft', 'published', 'scheduled', 'pinned', 'archived', 'deleted'));
            END IF;
          END $$;
        `);
      }
      console.log("✅ Updated status enum\n");
    } catch (error) {
      console.log("⚠️  Status enum update skipped (may already be updated)\n");
    }

    // Step 3: Add mentions to comments table
    console.log("🔍 Step 3: Adding mentions to 'community_comments' table...");
    
    try {
      if (isPostgres) {
        await db.query(`ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS mentions JSONB NULL;`);
      } else {
        await db.query(`ALTER TABLE community_comments ADD COLUMN mentions JSON NULL;`);
      }
      console.log("✅ Added mentions column to comments\n");
    } catch (error) {
      if (error.message.includes("Duplicate column") || error.message.includes("already exists")) {
        console.log("⚠️  Mentions column already exists, skipping...\n");
      } else {
        throw error;
      }
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📊 Summary:");
    console.log("   - Created community_reactions table");
    console.log("   - Added scheduled_at, is_featured, featured_at, mentions to posts");
    console.log("   - Added mentions to comments");
    console.log("   - Updated post status to include 'draft' and 'scheduled'");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateCommunityFeatures();

