import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to add a reset-token expiry column to students, staff,
 * and wsp_admins. Password reset tokens were previously stored with no
 * expiry, so a leaked/old token stayed valid forever until the next reset
 * request. This adds the column needed to enforce a 1-hour expiry window.
 *
 * Run with: node scripts/migrate-add-password-reset-expiry.js
 */

const TARGETS = [
  { table: "students", column: "token_expires_at" },
  { table: "staff", column: "token_expires_at" },
  { table: "wsp_admins", column: "password_reset_expires_at" },
  { table: "sole_tutors", column: "password_reset_expires_at" },
  { table: "organizations", column: "password_reset_expires_at" },
];

async function addExpiryColumn(dialect, table, column) {
  const existing = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = :table AND column_name = :column`,
    { type: QueryTypes.SELECT, replacements: { table, column } }
  );

  if (existing && existing.length > 0) {
    console.log(`   ⏭️  '${table}.${column}' already exists. Skipping...`);
    return;
  }

  if (dialect === "postgres" || dialect === "mysql" || dialect === "mariadb") {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} TIMESTAMP NULL`);
  } else {
    throw new Error(`Unsupported database dialect: ${dialect}`);
  }

  console.log(`   ✅ '${table}.${column}' added successfully.`);
}

async function migrate() {
  try {
    await db.authenticate();
    console.log("✅ Database connection established successfully.");

    const dialect = db.getDialect();
    console.log(`📦 Starting migration: Add password reset token expiry`);
    console.log(`Database dialect: ${dialect}\n`);

    for (const { table, column } of TARGETS) {
      console.log(`🔍 ${table}.${column}...`);
      await addExpiryColumn(dialect, table, column);
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
