import { db } from "../src/database/database.js";

/**
 * payment_setup.amount was an INTEGER column, silently truncating any
 * decimal fee amount (e.g. $49.99 -> $49) for USD/GBP/EUR-priced items.
 * Widens it to NUMERIC(12,2) to match schoolFeesConfiguration.amount, which
 * was already correctly typed. This is a lossless widening conversion —
 * every existing integer value fits exactly into NUMERIC(12,2).
 *
 * Run with: node scripts/migrate-payment-setup-amount-to-decimal.js
 */

async function migrate() {
  try {
    await db.authenticate();
    console.log("✅ Database connection established successfully.");

    const [before] = await db.query(
      `SELECT data_type FROM information_schema.columns WHERE table_name = 'payment_setup' AND column_name = 'amount'`
    );
    console.log("Current type:", before[0]?.data_type);

    if (before[0]?.data_type === "numeric") {
      console.log("⏭️  Already numeric. Skipping.");
      process.exit(0);
    }

    await db.query(
      `ALTER TABLE payment_setup ALTER COLUMN amount TYPE NUMERIC(12,2) USING amount::numeric(12,2)`
    );
    console.log("✅ payment_setup.amount converted to NUMERIC(12,2)");

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
