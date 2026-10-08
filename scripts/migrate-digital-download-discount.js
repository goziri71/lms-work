/**
 * Digital download sale discount fields (same as courses).
 * Run: node scripts/migrate-digital-download-discount.js
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

async function addColumn(table, column, ddl) {
  if (await columnExists(table, column)) {
    console.log(`⏭️  ${table}.${column} already exists`);
    return;
  }
  await db.query(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
  console.log(`✅ Added ${table}.${column}`);
}

async function run() {
  try {
    await db.authenticate();
    await addColumn(
      "digital_downloads",
      "discount_percent",
      "discount_percent DECIMAL(5,2) NULL DEFAULT 0"
    );
    await addColumn(
      "digital_downloads",
      "discount_starts_at",
      "discount_starts_at TIMESTAMP NULL"
    );
    await addColumn(
      "digital_downloads",
      "discount_ends_at",
      "discount_ends_at TIMESTAMP NULL"
    );
    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
