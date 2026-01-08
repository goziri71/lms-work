import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Fix coaching_sessions.currency column to allow NULL values
 * This is needed because free sessions don't require a currency
 */
async function fixCurrencyColumn() {
  try {
    await db.authenticate();
    console.log("✅ Database connection established");
    console.log("🔧 Fixing currency column to allow NULL values...");

    // Check if column exists
    const [columnInfo] = await db.query(
      `SELECT 
        column_name, 
        is_nullable, 
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'coaching_sessions' 
      AND column_name = 'currency';`,
      { type: QueryTypes.SELECT }
    );

    if (!columnInfo) {
      console.log("⚠️  Currency column does not exist. Skipping...");
      return;
    }

    if (columnInfo.is_nullable === "YES") {
      console.log("✅ Currency column already allows NULL values. No changes needed.");
      return;
    }

    // Alter column to allow NULL
    await db.query(`
      ALTER TABLE coaching_sessions
      ALTER COLUMN currency DROP NOT NULL;
    `);

    console.log("✅ Successfully updated currency column to allow NULL values");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing currency column:", error);
    process.exit(1);
  }
}

fixCurrencyColumn();
