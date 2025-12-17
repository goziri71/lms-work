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

async function checkColumnSizes() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    console.log("=".repeat(60));
    console.log("CHECKING COLUMN SIZES FOR PAYMENT REFERENCE");
    console.log("=".repeat(60) + "\n");

    // Check marketplace_transactions table
    console.log("📊 Checking marketplace_transactions table:");
    const [marketplaceColumns] = await db.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'marketplace_transactions'
        AND column_name IN ('payment_reference', 'payment_method')
      ORDER BY column_name;
    `);

    marketplaceColumns.forEach(col => {
      console.log(`  ${col.column_name.padEnd(20)} - ${col.data_type}(${col.character_maximum_length || 'N/A'})`);
    });
    console.log();

    // Check course_reg table for ref field
    console.log("📊 Checking course_reg table:");
    const [courseRegColumns] = await db.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'course_reg'
        AND column_name = 'ref'
      ORDER BY column_name;
    `);

    courseRegColumns.forEach(col => {
      console.log(`  ${col.column_name.padEnd(20)} - ${col.data_type}(${col.character_maximum_length || 'N/A'})`);
    });
    console.log();

    // Check all VARCHAR(20) columns that might be related
    console.log("📊 Checking all VARCHAR(20) columns in related tables:");
    const [varchar20Columns] = await db.query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE (table_name = 'marketplace_transactions' 
             OR table_name = 'course_reg'
             OR table_name = 'payment_transactions')
        AND data_type = 'character varying'
        AND character_maximum_length = 20
      ORDER BY table_name, column_name;
    `);

    if (varchar20Columns.length > 0) {
      console.log("  ⚠️  Found VARCHAR(20) columns that might cause issues:");
      varchar20Columns.forEach(col => {
        console.log(`  ${col.table_name}.${col.column_name} - VARCHAR(${col.character_maximum_length})`);
      });
    } else {
      console.log("  ✅ No VARCHAR(20) columns found in related tables");
    }
    console.log();

    console.log("=".repeat(60));
    console.log("Check complete!");
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.close();
  }
}

checkColumnSizes();

