/**
 * One-time migration: Permanently delete all soft-deleted courses.
 * Removes rows where deleted_at IS NOT NULL so slugs/codes can be reused.
 * Run: node scripts/migrate-purge-soft-deleted-courses.js
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

    // Check how many soft-deleted courses exist
    const [countResult] = await db.query(
      `SELECT COUNT(*) as count FROM courses WHERE deleted_at IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );
    const count = parseInt(countResult.count);
    console.log(`📊 Found ${count} soft-deleted course(s)`);

    if (count === 0) {
      console.log("✅ No soft-deleted courses to purge. Done.");
      process.exit(0);
    }

    // List them before deleting
    const softDeleted = await db.query(
      `SELECT id, title, slug, course_code, owner_id, deleted_at FROM courses WHERE deleted_at IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );
    console.log("\n🗑️  Courses to be permanently deleted:");
    softDeleted.forEach((c) => {
      console.log(`   - ID: ${c.id} | Title: ${c.title} | Slug: ${c.slug} | Code: ${c.course_code} | Deleted at: ${c.deleted_at}`);
    });

    // Permanently delete
    const [, result] = await db.query(
      `DELETE FROM courses WHERE deleted_at IS NOT NULL`,
      { type: QueryTypes.DELETE }
    );
    console.log(`\n✅ Permanently deleted ${count} soft-deleted course(s)`);
    console.log("✅ Done.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    console.error(err);
    process.exit(1);
  }
}

migrate();
