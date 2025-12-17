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
 * Migration: Increase payment_reference column size in marketplace_transactions table
 * 
 * Changes payment_reference from VARCHAR(20) to VARCHAR(255) to support longer Flutterwave transaction references
 * 
 * ⚠️ SAFETY: This script ONLY MODIFIES the column type. It NEVER deletes or modifies existing data.
 */
async function migratePaymentReferenceSize() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    console.log("=".repeat(60));
    console.log("MIGRATING payment_reference COLUMN SIZE");
    console.log("=".repeat(60) + "\n");

    // Check current column size
    console.log("📊 Checking current column definition...");
    const [currentColumn] = await db.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'marketplace_transactions'
        AND column_name = 'payment_reference';
    `);

    if (currentColumn.length === 0) {
      console.log("❌ Column 'payment_reference' not found in marketplace_transactions table");
      return;
    }

    const currentSize = currentColumn[0].character_maximum_length;
    console.log(`  Current size: VARCHAR(${currentSize || 'N/A'})\n`);

    if (currentSize >= 255) {
      console.log("✅ Column is already VARCHAR(255) or larger. No migration needed.\n");
      return;
    }

    // Alter column to increase size
    console.log("🔄 Altering payment_reference column to VARCHAR(255)...");
    console.log("--------------------------------------------------------------------------------");

    try {
      await db.query(`
        ALTER TABLE marketplace_transactions
        ALTER COLUMN payment_reference TYPE VARCHAR(255);
      `);
      console.log("  ✅ Column altered successfully\n");
    } catch (error) {
      if (error.message.includes("does not exist")) {
        console.log("  ⚠️  Column does not exist - may need to create it first");
      } else {
        throw error;
      }
    }

    // Verify the change
    console.log("✅ Verification - Checking new column definition...");
    const [updatedColumn] = await db.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'marketplace_transactions'
        AND column_name = 'payment_reference';
    `);

    if (updatedColumn.length > 0) {
      const newSize = updatedColumn[0].character_maximum_length;
      console.log(`  New size: VARCHAR(${newSize || 'N/A'})\n`);
      
      if (newSize >= 255) {
        console.log("✅ Migration successful! Column is now VARCHAR(255)\n");
      } else {
        console.log("⚠️  Warning: Column size is still less than 255\n");
      }
    }

    console.log("=".repeat(60));
    console.log("Migration complete!");
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("❌ Error during migration:", error);
    throw error;
  } finally {
    await db.close();
  }
}

migratePaymentReferenceSize();

