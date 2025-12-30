import { connectDB } from "../src/database/database.js";
import { dbLibrary } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to change units.title column from VARCHAR(255) to TEXT
 * This allows for longer unit titles without character limits
 * 
 * Run with: node scripts/migrate-units-title-to-text.js
 */

async function migrateUnitsTitleToText() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("📦 Starting migration: Change units.title to TEXT\n");

    const dialect = dbLibrary.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    // Check current column type
    console.log("🔍 Checking current column type...");
    const columnInfo = await dbLibrary.query(
      `SELECT column_name, data_type, character_maximum_length
       FROM information_schema.columns
       WHERE table_name = 'units' AND column_name = 'title'`,
      { type: QueryTypes.SELECT }
    );

    if (!columnInfo || columnInfo.length === 0) {
      console.log("⚠️  Column 'title' does not exist in 'units' table.");
      process.exit(1);
    }

    const currentType = columnInfo[0].data_type;
    const maxLength = columnInfo[0].character_maximum_length;

    console.log(`Current title column type: ${currentType}(${maxLength || 'unlimited'})\n`);

    if (currentType === 'text') {
      console.log("✅ Column 'title' is already TEXT. Migration not needed.");
      process.exit(0);
    }

    // Alter column to TEXT
    console.log(`🔄 Altering 'title' column from ${currentType}(${maxLength || 'unlimited'}) to TEXT...`);
    
    if (dialect === 'postgres') {
      await dbLibrary.query(`
        ALTER TABLE units
        ALTER COLUMN title TYPE TEXT
      `);
    } else if (dialect === 'mysql' || dialect === 'mariadb') {
      await dbLibrary.query(`
        ALTER TABLE units
        MODIFY COLUMN title TEXT
      `);
    } else {
      console.error(`❌ Unsupported database dialect: ${dialect}`);
      console.error("Please manually alter the column type to TEXT");
      process.exit(1);
    }
    
    console.log("✅ Column 'title' updated to TEXT");

    // Verify the change
    console.log("\n🔄 Verifying the change...");
    const verifyColumn = await dbLibrary.query(
      `SELECT column_name, data_type, character_maximum_length
       FROM information_schema.columns
       WHERE table_name = 'units' AND column_name = 'title'`,
      { type: QueryTypes.SELECT }
    );

    if (verifyColumn && verifyColumn.length > 0) {
      const newType = verifyColumn[0].data_type;
      const newLength = verifyColumn[0].character_maximum_length;
      console.log(`✅ Verification: Column 'title' is now ${newType}(${newLength || 'unlimited'})`);
    }

    console.log("\n==================================================");
    console.log("✅ MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================");
    console.log("\n📝 Next steps:");
    console.log("   1. The database column has been updated to TEXT");
    console.log("   2. The model will be updated to reflect this change");
    console.log("   3. Unit titles can now accept unlimited text length\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    if (error.original) {
      console.error("   Original error:", error.original.message);
    }
    console.error("\nFull error:", error);
    process.exit(1);
  }
}

migrateUnitsTitleToText();

