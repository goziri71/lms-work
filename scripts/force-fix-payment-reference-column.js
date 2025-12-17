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
 * Force fix payment_reference column size
 * This uses raw SQL to directly alter the column, bypassing Sequelize
 */
async function forceFixPaymentReference() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    console.log("=".repeat(60));
    console.log("FORCE FIXING payment_reference COLUMN");
    console.log("=".repeat(60) + "\n");

    // Step 1: Check current column definition
    console.log("📊 Step 1: Checking current column definition...");
    const [currentColumn] = await db.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'marketplace_transactions'
        AND column_name = 'payment_reference';
    `);

    if (currentColumn.length === 0) {
      console.log("❌ Column 'payment_reference' not found in marketplace_transactions table");
      return;
    }

    const col = currentColumn[0];
    console.log(`  Current: ${col.column_name} - ${col.data_type}(${col.character_maximum_length || 'N/A'})`);
    console.log(`  Nullable: ${col.is_nullable}\n`);

    // Step 2: Force alter the column to VARCHAR(255) using raw SQL
    if (!col.character_maximum_length || col.character_maximum_length < 255) {
      console.log("🔄 Step 2: Altering column to VARCHAR(255) using raw SQL...");
      console.log("--------------------------------------------------------------------------------");
      
      try {
        // Use ALTER COLUMN with TYPE to change the size
        await db.query(`
          ALTER TABLE marketplace_transactions
          ALTER COLUMN payment_reference TYPE VARCHAR(255);
        `);
        console.log("  ✅ Column altered successfully\n");
      } catch (error) {
        console.error(`  ❌ Error altering column: ${error.message}`);
        console.error(`  Full error: ${error}\n`);
        
        // Try alternative approach if the first one fails
        console.log("  🔄 Trying alternative approach (dropping and recreating)...");
        try {
          // This is more aggressive but should work
          await db.query(`
            ALTER TABLE marketplace_transactions
            ALTER COLUMN payment_reference TYPE VARCHAR(255) USING payment_reference::VARCHAR(255);
          `);
          console.log("  ✅ Column altered using alternative method\n");
        } catch (altError) {
          console.error(`  ❌ Alternative method also failed: ${altError.message}\n`);
          throw altError;
        }
      }
    } else {
      console.log("  ✅ Column is already VARCHAR(255) or larger\n");
    }

    // Step 3: Verify the change
    console.log("✅ Step 3: Verifying the change...");
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
        console.log("✅ SUCCESS! Column is now VARCHAR(255)\n");
      } else {
        console.log(`⚠️  WARNING: Column size is still ${newSize}, which may be too small\n`);
      }
    }

    // Step 4: Also check and fix payment_method if needed
    console.log("📊 Step 4: Checking payment_method column...");
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
      const methodSize = methodColumn[0].character_maximum_length;
      console.log(`  Current: VARCHAR(${methodSize || 'N/A'})\n`);
      
      if (!methodSize || methodSize < 50) {
        console.log("  🔄 Altering payment_method to VARCHAR(50)...");
        try {
          await db.query(`
            ALTER TABLE marketplace_transactions
            ALTER COLUMN payment_method TYPE VARCHAR(50);
          `);
          console.log("  ✅ payment_method column updated\n");
        } catch (error) {
          console.error(`  ❌ Error: ${error.message}\n`);
        }
      } else {
        console.log("  ✅ payment_method is already VARCHAR(50) or larger\n");
      }
    }

    console.log("=".repeat(60));
    console.log("Migration complete!");
    console.log("=".repeat(60) + "\n");
    console.log("💡 If you're still getting the error, make sure:");
    console.log("   1. You're running this script on the SAME database where the error occurs");
    console.log("   2. The application is restarted after running this script");
    console.log("   3. Check if there are multiple database environments (dev/staging/prod)\n");

  } catch (error) {
    console.error("❌ Error during migration:", error);
    throw error;
  } finally {
    await db.close();
  }
}

forceFixPaymentReference();

