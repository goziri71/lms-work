import { db } from "../src/database/database.js";

/**
 * Adds indexes for two hot, previously-unindexed query patterns:
 *  - funding(student_id, type, currency): summed on every wallet balance
 *    check (walletBalanceService.calculateLedgerBalance), including on the
 *    payment-webhook and wallet-payment hot paths.
 *  - courses(owner_type, owner_id): filtered on nearly every request via the
 *    dataIsolation middleware, plus marketplace/tutor course browsing.
 *  - courses(is_marketplace, marketplace_status): filtered on every
 *    marketplace browse call.
 *
 * Uses CREATE INDEX CONCURRENTLY so it doesn't hold a lock against writes on
 * these tables while building (safe to run against a live production DB).
 *
 * Run with: node scripts/migrate-add-perf-indexes.js
 */

const INDEXES = [
  {
    name: "idx_funding_student_type_currency",
    table: "funding",
    columns: "student_id, type, currency",
  },
  {
    name: "idx_courses_owner",
    table: "courses",
    columns: "owner_type, owner_id",
  },
  {
    name: "idx_courses_marketplace_status",
    table: "courses",
    columns: "is_marketplace, marketplace_status",
  },
];

async function migrate() {
  try {
    await db.authenticate();
    console.log("✅ Database connection established successfully.");

    for (const { name, table, columns } of INDEXES) {
      console.log(`🔍 ${name} on ${table}(${columns})...`);
      // CONCURRENTLY cannot run inside a transaction block; Sequelize's
      // plain db.query runs each call as its own statement, which is fine.
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
