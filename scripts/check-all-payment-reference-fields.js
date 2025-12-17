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

async function checkAllPaymentReferenceFields() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    console.log("=".repeat(60));
    console.log("CHECKING ALL PAYMENT REFERENCE FIELDS");
    console.log("=".repeat(60) + "\n");

    // Check all tables that might have payment reference fields
    const tablesToCheck = [
      'marketplace_transactions',
      'payment_transactions',
      'school_fees',
      'course_reg',
      'funding',
      'course_order'
    ];

    for (const tableName of tablesToCheck) {
      console.log(`📊 Checking ${tableName} table:`);
      
      const [columns] = await db.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_name = $1
          AND (
            column_name LIKE '%reference%' 
            OR column_name LIKE '%ref%'
            OR column_name LIKE '%teller%'
            OR column_name LIKE '%payment_method%'
          )
        ORDER BY column_name;
      `, {
        bind: [tableName],
        type: db.QueryTypes.SELECT
      });

      if (columns.length === 0) {
        console.log("  (No relevant columns found)\n");
      } else {
        columns.forEach(col => {
          const maxLen = col.character_maximum_length || 'N/A';
          const warning = (maxLen !== 'N/A' && maxLen < 50) ? ' ⚠️' : '';
          console.log(`  ${col.column_name.padEnd(25)} - ${col.data_type}(${maxLen})${warning}`);
        });
        console.log();
      }
    }

    // Check specifically for VARCHAR(20) columns that might be problematic
    console.log("⚠️  Checking for VARCHAR(20) columns that might cause issues:");
    const [varchar20Cols] = await db.query(`
      SELECT 
        table_name,
        column_name,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name IN ('marketplace_transactions', 'payment_transactions', 'school_fees', 'course_reg', 'funding', 'course_order')
        AND data_type = 'character varying'
        AND character_maximum_length = 20
        AND (
          column_name LIKE '%reference%' 
          OR column_name LIKE '%ref%'
          OR column_name LIKE '%teller%'
          OR column_name LIKE '%payment_method%'
        )
      ORDER BY table_name, column_name;
    `);

    if (varchar20Cols.length > 0) {
      console.log("\n  ⚠️  Found VARCHAR(20) columns that might cause issues:");
      varchar20Cols.forEach(col => {
        console.log(`  ${col.table_name}.${col.column_name} - VARCHAR(${col.character_maximum_length})`);
      });
      console.log();
    } else {
      console.log("  ✅ No problematic VARCHAR(20) columns found\n");
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

checkAllPaymentReferenceFields();

