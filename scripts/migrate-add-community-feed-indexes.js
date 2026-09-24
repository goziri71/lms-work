import { db } from "../src/database/database.js";

/**
 * Composite indexes matching the community "blog" feed's actual query
 * shapes, so Postgres can satisfy them without a separate sort step:
 *  - community_posts: WHERE community_id = ? [AND status ...]
 *    ORDER BY is_featured DESC, created_at DESC
 *  - community_comments: WHERE post_id = ? AND status = 'published'
 *    ORDER BY created_at ASC
 *
 * Uses CREATE INDEX CONCURRENTLY so it doesn't lock these tables against
 * writes while building (safe to run against a live production DB).
 *
 * Run with: node scripts/migrate-add-community-feed-indexes.js
 */

const INDEXES = [
  {
    name: "idx_community_posts_feed",
    table: "community_posts",
    columns: "community_id, is_featured DESC, created_at DESC",
  },
  {
    name: "idx_community_comments_post_status_created",
    table: "community_comments",
    columns: "post_id, status, created_at",
  },
];

async function migrate() {
  try {
    await db.authenticate();
    console.log("✅ Database connection established successfully.");

    for (const { name, table, columns } of INDEXES) {
      console.log(`🔍 ${name} on ${table}(${columns})...`);
      await db.query(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ON ${table} (${columns})`
      );
      console.log(`   ✅ ${name} ready.`);
    }

    console.log("\n✅ MIGRATION COMPLETED SUCCESSFULLY!");
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
