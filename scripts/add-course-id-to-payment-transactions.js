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

async function addCourseIdToPaymentTransactions() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    console.log("=".repeat(60));
    console.log("ADDING course_id COLUMN TO payment_transactions");
    console.log("=".repeat(60) + "\n");

    // Check if column already exists
    const [columnCheck] = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'payment_transactions'
        AND column_name = 'course_id';
    `);

    if (columnCheck.length > 0) {
      console.log("✅ Column 'course_id' already exists in 'payment_transactions'");
      console.log("   No migration needed.\n");
    } else {
      console.log("📊 Adding course_id column...");
      
      // Add course_id column
      await db.query(`
        ALTER TABLE payment_transactions
        ADD COLUMN course_id INTEGER;
      `);

      console.log("✅ Column 'course_id' added successfully");

      // Add comment
      await db.query(`
        COMMENT ON COLUMN payment_transactions.course_id IS 'Course ID for marketplace course purchases';
      `);

      console.log("✅ Column comment added");
    }

    // Verify the column
    const [finalCheck] = await db.query(`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payment_transactions'
        AND column_name = 'course_id';
    `);

    if (finalCheck.length > 0) {
      console.log("\n✅ Final Verification:");
      console.log(`  Column: ${finalCheck[0].column_name}`);
      console.log(`  Type: ${finalCheck[0].data_type}`);
      console.log(`  Nullable: ${finalCheck[0].is_nullable}`);
    }

    console.log("\n============================================================");
    console.log("Migration complete!");
    console.log("============================================================\n");

  } catch (error) {
    console.error("❌ Error during migration:", error);
  } finally {
    await db.close();
  }
}

addCourseIdToPaymentTransactions();

