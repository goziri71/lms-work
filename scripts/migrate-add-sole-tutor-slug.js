/**
 * Migration: Add slug column to sole_tutors for public tutor page URLs
 * Run: node scripts/migrate-add-sole-tutor-slug.js
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

async function migrate() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ Database connected.");
    console.log("📦 Migration: Add slug to sole_tutors\n");

    const dialect = db.getDialect();

    if (dialect !== "postgres") {
      console.log(
        "⚠️  This script uses PostgreSQL. For other DBs, add slug column manually and backfill."
      );
      process.exit(0);
    }

    const [colExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'sole_tutors' AND column_name = 'slug'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (colExists.exists) {
      console.log("⏭️  Column 'slug' already exists on sole_tutors.");
    } else {
      await db.query(`
        ALTER TABLE sole_tutors
        ADD COLUMN slug VARCHAR(120) UNIQUE;
      `);
      console.log("✅ Added column 'slug' to sole_tutors.");
    }

    const rows = await db.query(
      `SELECT id, fname, lname FROM sole_tutors WHERE slug IS NULL OR slug = '';`,
      { type: QueryTypes.SELECT }
    );

    if (rows.length === 0) {
      console.log("✅ No rows to backfill.");
      process.exit(0);
    }

    console.log(`🔄 Backfilling slug for ${rows.length} tutor(s)...`);
    const used = new Set();

    for (const row of rows) {
      const base = slugify(`${row.fname || ""} ${row.lname || ""}`.trim());
      let slug = base || `tutor-${row.id}`;
      let n = 1;
      while (used.has(slug)) {
        slug = `${base}-${n}`;
        n++;
      }
      used.add(slug);
      await db.query(`UPDATE sole_tutors SET slug = :slug WHERE id = :id`, {
        replacements: { slug, id: row.id },
      });
    }

    console.log("✅ Backfill complete.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

migrate();
