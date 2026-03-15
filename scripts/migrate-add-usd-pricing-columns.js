import { db } from "../src/database/database.js";

async function addUsdPricingColumns() {
  try {
    await db.authenticate();
    console.log("Connected to database");

    const dialect = db.getDialect();
    if (dialect !== "postgres") {
      console.log("This migration currently supports PostgreSQL only.");
      process.exit(0);
    }

    const statements = [
      `ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_usd VARCHAR(12);`,
      `ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS price_usd DECIMAL(10,2);`,
      `ALTER TABLE digital_downloads ADD COLUMN IF NOT EXISTS price_usd DECIMAL(10,2);`,
      `ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS price_usd DECIMAL(10,2);`,
      `ALTER TABLE communities ADD COLUMN IF NOT EXISTS price_usd DECIMAL(10,2);`,
      `ALTER TABLE memberships ADD COLUMN IF NOT EXISTS price_usd DECIMAL(10,2);`,
      `ALTER TABLE membership_tiers ADD COLUMN IF NOT EXISTS monthly_price_usd DECIMAL(10,2);`,
      `ALTER TABLE membership_tiers ADD COLUMN IF NOT EXISTS yearly_price_usd DECIMAL(10,2);`,
      `ALTER TABLE membership_tiers ADD COLUMN IF NOT EXISTS lifetime_price_usd DECIMAL(10,2);`,
    ];

    for (const statement of statements) {
      await db.query(statement);
      console.log(`Executed: ${statement}`);
    }

    console.log("USD pricing columns migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
}

addUsdPricingColumns();
