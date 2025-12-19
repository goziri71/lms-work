import { connectDB } from "../src/database/database.js";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to change funding.amount from INTEGER to DECIMAL(10, 2)
 * This allows storing decimal amounts (e.g., 2.50 USD) accurately
 * 
 * Run with: node scripts/migrate-funding-amount-to-decimal.js
 */
async function migrateFundingAmountToDecimal() {
  try {
    // Connect to database
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("📦 Starting migration: funding.amount INTEGER → DECIMAL(10, 2)\n");

    // Check current column type
    const columnInfo = await db.query(`
      SELECT data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'funding'
        AND column_name = 'amount'
    `, { type: QueryTypes.SELECT });

    if (columnInfo && columnInfo.length > 0) {
      const currentType = columnInfo[0];
      console.log(`Current column type: ${currentType.data_type}`);
      
      if (currentType.data_type === 'numeric' || currentType.data_type === 'decimal') {
        console.log("✅ Column is already DECIMAL. Migration not needed.");
        process.exit(0);
      }
    }

    // Get database dialect to use appropriate SQL syntax
    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    if (dialect === 'postgres') {
      // PostgreSQL: Use ALTER COLUMN
      console.log("🔄 Altering column type to DECIMAL(10, 2)...");
      await db.query(`
        ALTER TABLE funding
        ALTER COLUMN amount TYPE DECIMAL(10, 2)
        USING amount::DECIMAL(10, 2)
      `);
      console.log("✅ Column type changed successfully");
    } else if (dialect === 'mysql' || dialect === 'mariadb') {
      // MySQL/MariaDB: Use MODIFY COLUMN
      console.log("🔄 Altering column type to DECIMAL(10, 2)...");
      await db.query(`
        ALTER TABLE funding
        MODIFY COLUMN amount DECIMAL(10, 2)
      `);
      console.log("✅ Column type changed successfully");
    } else {
      console.error(`❌ Unsupported database dialect: ${dialect}`);
      console.error("Please manually alter the column type to DECIMAL(10, 2)");
      process.exit(1);
    }

    // Verify the change
    const newColumnInfo = await db.query(`
      SELECT data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'funding'
        AND column_name = 'amount'
    `, { type: QueryTypes.SELECT });

    if (newColumnInfo && newColumnInfo.length > 0) {
      const newType = newColumnInfo[0];
      console.log(`\n✅ Verification: Column type is now ${newType.data_type}(${newType.numeric_precision}, ${newType.numeric_scale})`);
    }

    // Check for any existing decimal values that were rounded
    const sampleRecords = await db.query(`
      SELECT id, amount, currency, type, service_name
      FROM funding
      WHERE amount IS NOT NULL
      ORDER BY id DESC
      LIMIT 10
    `, { type: QueryTypes.SELECT });

    if (sampleRecords && sampleRecords.length > 0) {
      console.log("\n📊 Sample records after migration:");
      sampleRecords.forEach(record => {
        console.log(`  ID ${record.id}: ${record.amount} ${record.currency || 'NGN'} (${record.type}) - ${record.service_name}`);
      });
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("💡 Note: Existing integer values remain as integers (e.g., 1000.00)");
    console.log("   New decimal values (e.g., 2.50) can now be stored accurately.\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    if (error.original) {
      console.error("   Database error:", error.original.message);
    }
    console.error("\nFull error:", error);
    process.exit(1);
  }
}

// Run migration
migrateFundingAmountToDecimal();

