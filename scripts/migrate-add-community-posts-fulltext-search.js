import { db } from "../src/database/database.js";

/**
 * community_posts search was using `content ILIKE '%term%'` with a leading
 * wildcard, which can never use a plain btree index and forces a full table
 * scan on every search request regardless of table size. Adds a generated
 * tsvector column (kept in sync automatically by Postgres on every
 * insert/update) plus a GIN index, so search becomes an index lookup.
 *
 * Run with: node scripts/migrate-add-community-posts-fulltext-search.js
 */

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column`,
    { replacements: { table, column } }
  );
  return rows.length > 0;
}

async function migrate() {
  try {
    await db.authenticate();
    console.log("✅ Database connection established successfully.");

    if (await columnExists("community_posts", "search_vector")) {
      console.log("⏭️  search_vector already exists. Skipping column add.");
    } else {
      console.log("🔍 Adding generated search_vector column...");
      await db.query(`
        ALTER TABLE community_posts
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
          to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
        ) STORED
      `);
      console.log("   ✅ search_vector added (Postgres keeps it in sync automatically).");
    }

    console.log("🔍 idx_community_posts_search_vector...");
    await db.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_posts_search_vector ON community_posts USING GIN (search_vector)`
    );
    console.log("   ✅ idx_community_posts_search_vector ready.");

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
