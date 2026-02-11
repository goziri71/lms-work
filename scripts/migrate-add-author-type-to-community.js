/**
 * Migration: Add author_type column to community_posts and community_comments tables.
 * Fixes author name resolution for students vs tutors.
 * Run: node scripts/migrate-add-author-type-to-community.js
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function migrate() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }
    console.log("✅ Connected to database");

    // Add author_type to community_posts
    const [postCols] = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'community_posts' AND column_name = 'author_type'`,
      { type: QueryTypes.SELECT }
    ).catch(() => [null]);

    if (!postCols) {
      await db.query(
        `ALTER TABLE community_posts ADD COLUMN author_type VARCHAR(30) DEFAULT NULL`
      );
      console.log("✅ Added author_type to community_posts");
    } else {
      console.log("⚠️  author_type already exists on community_posts");
    }

    // Add author_type to community_comments
    const [commentCols] = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'community_comments' AND column_name = 'author_type'`,
      { type: QueryTypes.SELECT }
    ).catch(() => [null]);

    if (!commentCols) {
      await db.query(
        `ALTER TABLE community_comments ADD COLUMN author_type VARCHAR(30) DEFAULT NULL`
      );
      console.log("✅ Added author_type to community_comments");
    } else {
      console.log("⚠️  author_type already exists on community_comments");
    }

    console.log("✅ Done.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    console.error(err);
    process.exit(1);
  }
}

migrate();
