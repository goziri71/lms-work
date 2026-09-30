/**
 * Link learner + creator accounts (same person, dual login).
 *
 * Run: node scripts/migrate-creator-student-link.js
 */

import dotenv from "dotenv";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

dotenv.config({ debug: false });

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

async function addLinkedStudentId(table) {
  const col = "linked_student_id";
  if (await columnExists(table, col)) {
    console.log(`⏭️  ${table}.${col} already exists`);
    return;
  }
  await db.query(`
    ALTER TABLE ${table}
    ADD COLUMN linked_student_id INTEGER NULL
    REFERENCES students(id) ON DELETE SET NULL;
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_${table}_linked_student_id
    ON ${table}(linked_student_id);
  `);
  console.log(`✅ Added ${table}.${col}`);
}

async function run() {
  try {
    await db.authenticate();
    console.log("✅ Database connected.\n");
    await addLinkedStudentId("sole_tutors");
    await addLinkedStudentId("organizations");
    console.log("\nDone.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

run();
