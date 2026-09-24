import { db } from "../src/database/database.js";

/**
 * Adds community_posts.image_thumbnail_url — a small (max 400px) variant
 * generated alongside the existing full-size image, so a feed page can
 * render N post thumbnails without downloading N full-resolution images.
 *
 * Run with: node scripts/migrate-add-community-post-thumbnail.js
 */

async function migrate() {
  try {
    await db.authenticate();
    console.log("✅ Database connection established successfully.");

    const [existing] = await db.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'community_posts' AND column_name = 'image_thumbnail_url'`
    );

    if (existing.length > 0) {
      console.log("⏭️  image_thumbnail_url already exists. Skipping.");
      process.exit(0);
    }

    await db.query(
      `ALTER TABLE community_posts ADD COLUMN image_thumbnail_url TEXT NULL`
    );
    console.log("✅ community_posts.image_thumbnail_url added.");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    if (error.original) {
      console.error("   Original error:", error.original.message);
    }
    process.exit(1);
  }
}

migrate();
