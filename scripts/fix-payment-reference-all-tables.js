import dotenv from "dotenv";
import { Sequelize } from "sequelize";
import { Config } from "../src/config/config.js";

dotenv.config({ debug: false });

const db = new Sequelize(
  Config.database.url || Config.database.name,
  Config.database.username,
  Config.database.password,
  {
    host: Config.database.host,
    dialect: Config.database.dialect,
    logging: console.log,
    dialectOptions: Config.database.dialectOptions,
    pool: Config.database.pool,
  }
);

/**
 * Migration: Ensure payment_reference and payment_method columns are large enough
 * 
 * This script will:
 * 1. Check current column sizes
 * 2. Update payment_reference to VARCHAR(255) if needed
 * 3. Update payment_method to VARCHAR(50) if needed
 */
async function fixPaymentColumns() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    console.log("=".repeat(60));
    console.log("FIXING PAYMENT COLUMN SIZES");
    console.log("=".repeat(60) + "\n");

    // Check and fix payment_reference
    console.log("📊 Checking payment_reference column...");
    const [refColumn] = await db.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'marketplace_transactions'
        AND column_name = 'payment_reference';
    `);

    if (refColumn.length > 0) {
      const currentSize = refColumn[0].character_maximum_length;
      console.log(`  Current size: VARCHAR(${currentSize || 'N/A'})`);
      
      if (!currentSize || currentSize < 255) {
        console.log("  🔄 Updating to VARCHAR(255)...");
        try {
          await db.query(`
            ALTER TABLE marketplace_transactions
            ALTER COLUMN payment_reference TYPE VARCHAR(255);
          `);
          console.log("  ✅ Updated successfully\n");
        } catch (error) {
          console.error(`  ❌ Error updating: ${error.message}\n`);
        }
      } else {
        console.log("  ✅ Already VARCHAR(255) or larger\n");
      }
    } else {
      console.log("  ⚠️  Column not found\n");
    }

    // Check and fix payment_method
    console.log("📊 Checking payment_method column...");
    const [methodColumn] = await db.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'marketplace_transactions'
        AND column_name = 'payment_method';
    `);

    if (methodColumn.length > 0) {
      const currentSize = methodColumn[0].character_maximum_length;
      console.log(`  Current size: VARCHAR(${currentSize || 'N/A'})`);
      
      if (!currentSize || currentSize < 50) {
        console.log("  🔄 Updating to VARCHAR(50)...");
        try {
          await db.query(`
            ALTER TABLE marketplace_transactions
            ALTER COLUMN payment_method TYPE VARCHAR(50);
          `);
          console.log("  ✅ Updated successfully\n");
        } catch (error) {
          console.error(`  ❌ Error updating: ${error.message}\n`);
        }
      } else {
        console.log("  ✅ Already VARCHAR(50) or larger\n");
      }
    } else {
      console.log("  ⚠️  Column not found\n");
    }

    // Final verification
    console.log("✅ Final Verification:");
    const [finalCheck] = await db.query(`
      SELECT 
        column_name,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'marketplace_transactions'
        AND column_name IN ('payment_reference', 'payment_method')
      ORDER BY column_name;
    `);

    finalCheck.forEach(col => {
      console.log(`  ${col.column_name.padEnd(20)} - VARCHAR(${col.character_maximum_length || 'N/A'})`);
    });

    console.log("\n" + "=".repeat(60));
    console.log("Migration complete!");
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("❌ Error during migration:", error);
    throw error;
  } finally {
    await db.close();
  }
}

fixPaymentColumns();

