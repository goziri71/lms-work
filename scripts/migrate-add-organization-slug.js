/**
 * Migration: Add slug to organizations for public storefront URLs
 * Also sets Binah Church International → binah-church-international (active)
 *
 * Run: node scripts/migrate-add-organization-slug.js
 */

import dotenv from "dotenv";
import { connectDB, db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

dotenv.config({ debug: false });

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
    console.log("📦 Migration: Add slug to organizations\n");

    if (db.getDialect() !== "postgres") {
      console.log("⚠️  PostgreSQL required.");
      process.exit(0);
    }

    const [colExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'organizations'
          AND column_name = 'slug'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (colExists.exists) {
      console.log("⏭️  Column 'slug' already exists on organizations.");
    } else {
      await db.query(`
        ALTER TABLE organizations
        ADD COLUMN slug VARCHAR(120) UNIQUE;
      `);
      console.log("✅ Added column 'slug' to organizations.");
    }

    // Preferred slug for Binah Church International (org id 4)
    const preferred = [
      {
        id: 4,
        slug: "binah-church-international",
      },
    ];

    for (const pref of preferred) {
      const conflict = await db.query(
        `SELECT id, name FROM organizations
         WHERE slug = :slug AND id <> :id`,
        {
          type: QueryTypes.SELECT,
          replacements: { slug: pref.slug, id: pref.id },
        }
      );
      if (conflict.length) {
        console.warn(
          `⚠️  Slug '${pref.slug}' already used by org ${conflict[0].id}; skipping preferred set.`
        );
        continue;
      }

      await db.query(
        `UPDATE organizations
         SET slug = :slug, status = 'active', updated_at = NOW()
         WHERE id = :id`,
        { replacements: { slug: pref.slug, id: pref.id } }
      );
      console.log(
        `✅ Org ${pref.id} → slug='${pref.slug}', status='active'`
      );
    }

    const rows = await db.query(
      `SELECT id, name FROM organizations WHERE slug IS NULL OR slug = '';`,
      { type: QueryTypes.SELECT }
    );

    const usedRows = await db.query(
      `SELECT slug FROM organizations WHERE slug IS NOT NULL AND slug <> '';`,
      { type: QueryTypes.SELECT }
    );
    const used = new Set(usedRows.map((r) => r.slug));

    // Also avoid colliding with sole_tutors.slug storefront namespace
    try {
      const tutorSlugs = await db.query(
        `SELECT slug FROM sole_tutors WHERE slug IS NOT NULL AND slug <> '';`,
        { type: QueryTypes.SELECT }
      );
      tutorSlugs.forEach((r) => used.add(r.slug));
    } catch {
      // sole_tutors.slug may not exist in older DBs
    }

    if (rows.length === 0) {
      console.log("✅ No remaining orgs to backfill.");
    } else {
      console.log(`🔄 Backfilling slug for ${rows.length} organization(s)...`);
      for (const row of rows) {
        const base = slugify(row.name) || `org-${row.id}`;
        let slug = base;
        let n = 1;
        while (used.has(slug)) {
          slug = `${base}-${n}`;
          n++;
        }
        used.add(slug);
        await db.query(`UPDATE organizations SET slug = :slug WHERE id = :id`, {
          replacements: { slug, id: row.id },
        });
        console.log(`   org ${row.id} → ${slug}`);
      }
      console.log("✅ Backfill complete.");
    }

    const verify = await db.query(
      `SELECT id, name, slug, status FROM organizations WHERE id = 4`,
      { type: QueryTypes.SELECT }
    );
    console.log("\nVerify org 4:", JSON.stringify(verify, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

migrate();
