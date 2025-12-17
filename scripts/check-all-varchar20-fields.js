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

async function checkAllVarchar20Fields() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    console.log("=".repeat(60));
    console.log("CHECKING ALL VARCHAR(20) FIELDS IN RELEVANT TABLES");
    console.log("=".repeat(60) + "\n");

    // Check all tables that might be involved in marketplace purchase
    const tables = [
      'marketplace_transactions',
      'course_reg',
      'courses',
      'students',
      'wsp_commissions',
      'admin_activity_logs'
    ];

    for (const tableName of tables) {
      console.log(`📊 Checking ${tableName}:`);
      try {
        const [columns] = await db.query(`
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
            AND data_type = 'character varying'
            AND character_maximum_length <= 20
          ORDER BY column_name;
        `, {
          bind: [tableName],
          type: db.QueryTypes.SELECT
        });

        if (columns.length > 0) {
          console.log(`  ⚠️  Found ${columns.length} VARCHAR(≤20) column(s):`);
          columns.forEach(col => {
            console.log(`    - ${col.column_name.padEnd(30)} VARCHAR(${col.character_maximum_length}) ${col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'}`);
          });
        } else {
          console.log(`  ✅ No VARCHAR(≤20) columns found`);
        }
        console.log();
      } catch (error) {
        if (error.message.includes('does not exist') || error.message.includes('relation')) {
          console.log(`  ⚠️  Table does not exist\n`);
        } else {
          console.error(`  ❌ Error: ${error.message}\n`);
        }
      }
    }

    // Also check for any columns that might store payment references
    console.log("📊 Checking for columns with 'payment', 'reference', 'ref', 'method' in name:");
    try {
      const [paymentColumns] = await db.query(`
        SELECT 
          table_name,
          column_name,
          data_type,
          character_maximum_length
        FROM information_schema.columns
        WHERE (
          column_name ILIKE '%payment%' 
          OR column_name ILIKE '%reference%'
          OR column_name ILIKE '%ref%'
          OR column_name ILIKE '%method%'
        )
        AND table_name IN ('marketplace_transactions', 'course_reg', 'courses', 'payment_transactions')
        AND data_type = 'character varying'
        ORDER BY table_name, column_name;
      `);

      if (paymentColumns.length > 0) {
        paymentColumns.forEach(col => {
          const size = col.character_maximum_length || 'N/A';
          const warning = size <= 20 ? ' ⚠️  TOO SMALL!' : '';
          console.log(`  ${col.table_name}.${col.column_name.padEnd(30)} VARCHAR(${size})${warning}`);
        });
      } else {
        console.log("  ✅ No matching columns found");
      }
      console.log();

    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
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

checkAllVarchar20Fields();

