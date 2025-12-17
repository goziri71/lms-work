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
    logging: false,
    dialectOptions: Config.database.dialectOptions,
    pool: Config.database.pool,
  }
);

async function checkPaymentMethodColumn() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    console.log("=".repeat(60));
    console.log("CHECKING payment_method COLUMN SIZE");
    console.log("=".repeat(60) + "\n");

    const [columns] = await db.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'marketplace_transactions'
        AND column_name = 'payment_method';
    `);

    if (columns.length === 0) {
      console.log("❌ Column 'payment_method' not found");
    } else {
      const col = columns[0];
      console.log(`Column: ${col.column_name}`);
      console.log(`Type: ${col.data_type}`);
      console.log(`Max Length: ${col.character_maximum_length || 'N/A'}\n`);
      
      if (col.character_maximum_length && col.character_maximum_length < 50) {
        console.log(`⚠️  WARNING: Column is VARCHAR(${col.character_maximum_length}) but model expects STRING(50)`);
        console.log(`   The value "flutterwave" (${"flutterwave".length} chars) should fit, but let's check...\n`);
      }
    }

    console.log("=".repeat(60));
    console.log("Check complete!");
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.close();
  }
}

checkPaymentMethodColumn();

