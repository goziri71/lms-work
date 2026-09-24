/**
 * Events are always available. Education-only is no longer a product path.
 *
 * - existing signup_intent = 'education' → 'both'
 * - new-row default → 'events'
 *
 * Run: node scripts/migrate-signup-intent-events-first.js
 */

import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

async function columnExists(tableName, columnName) {
  const [row] = await db.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = :tableName
        AND column_name = :columnName
    ) AS exists;`,
    {
      type: QueryTypes.SELECT,
      replacements: { tableName, columnName },
    }
  );
  return !!row?.exists;
}

async function migrateTable(table) {
  if (!(await columnExists(table, "signup_intent"))) {
    console.log(`⏭️  ${table}.signup_intent missing — run migrate-add-signup-intent.js first`);
    return;
  }

  const [updated] = await db.query(
    `UPDATE ${table}
     SET signup_intent = 'both'
     WHERE signup_intent = 'education'`
  );
  const count = updated?.rowCount ?? updated;
  console.log(`✅ ${table}: mapped education → both (${count ?? "ok"})`);

  await db.query(
    `ALTER TABLE ${table} ALTER COLUMN signup_intent SET DEFAULT 'events'`
  );
  console.log(`✅ ${table}: default is now events`);
}

async function run() {
  try {
    await db.authenticate();
    console.log("✅ Database connection established successfully.");
    console.log("📦 signup_intent events-first\n");

    await migrateTable("sole_tutors");
    await migrateTable("organizations");

    console.log("\n✅ Migration complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    if (error.original) {
      console.error("   Original error:", error.original.message);
    }
    process.exit(1);
  }
}

run();
