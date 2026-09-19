import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Add "Religious and Faith" and "Social and Impact" to marketplace category
 * CHECK constraints (courses, digital_downloads, coaching_sessions, communities).
 *
 * Memberships already have these via migrate-add-membership-categories.js.
 *
 * Run: node scripts/migrate-add-marketplace-category-values.js
 */

const CATEGORY_LIST = [
  "Business & Management",
  "Technology & Data",
  "Engineering & Physical Science",
  "Health & Medicine",
  "Arts & Humanities",
  "Personal Development & Education",
  "Religious and Faith",
  "Social and Impact",
];

const TABLES = [
  "courses",
  "digital_downloads",
  "coaching_sessions",
  "communities",
];

async function dropCategoryConstraints(tableName) {
  const constraints = await db.query(
    `SELECT c.conname AS conname
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     WHERE t.relname = :tableName
       AND c.contype = 'c'
       AND (
         c.conname ILIKE '%category%'
         OR pg_get_constraintdef(c.oid) ILIKE '%category%'
       )`,
    {
      replacements: { tableName },
      type: QueryTypes.SELECT,
    }
  );

  const names = new Set(
    (Array.isArray(constraints) ? constraints : [])
      .map((row) => row?.conname)
      .filter(Boolean)
  );
  names.add(`${tableName}_category_check`);

  for (const conname of names) {
    console.log(`  🔄 Dropping constraint if exists: ${conname}`);
    await db.query(
      `ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS "${conname}"`
    );
  }
}

async function addCategoryConstraint(tableName) {
  const categoryList = CATEGORY_LIST.map(
    (cat) => `'${cat.replace(/'/g, "''")}'`
  ).join(", ");
  const constraintName = `${tableName}_category_check`;

  console.log(`  🔄 Adding constraint: ${constraintName}`);
  await db.query(`
    ALTER TABLE ${tableName}
    ADD CONSTRAINT ${constraintName}
    CHECK (category IS NULL OR category IN (${categoryList}))
  `);
  console.log(`  ✅ Added ${constraintName}`);
}

async function run() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");
    console.log("📦 Updating marketplace category CHECK constraints\n");

    if (db.getDialect() !== "postgres") {
      console.log("⚠️  PostgreSQL only — skipping");
      process.exit(0);
    }

    for (const tableName of TABLES) {
      console.log(`\n📋 Table: ${tableName}`);
      try {
        await dropCategoryConstraints(tableName);
        await addCategoryConstraint(tableName);
      } catch (error) {
        console.error(`  ❌ Failed for ${tableName}:`, error.message);
        throw error;
      }
    }

    console.log("\n✅ Migration completed successfully");
    console.log("   Allowed categories now include:");
    CATEGORY_LIST.forEach((c) => console.log(`   - ${c}`));
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

run();
