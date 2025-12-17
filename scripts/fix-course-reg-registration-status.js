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

async function fixCourseRegRegistrationStatus() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    console.log("=".repeat(60));
    console.log("FIXING course_reg.registration_status COLUMN");
    console.log("=".repeat(60) + "\n");

    // Step 1: Check current column definition
    console.log("📊 Step 1: Checking current column definition...");
    const [currentDef] = await db.query(`
      SELECT
        column_name,
        data_type,
        udt_name,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'course_reg'
        AND column_name = 'registration_status';
    `);

    if (currentDef.length === 0) {
      console.log("  ❌ Column 'registration_status' not found in 'course_reg'");
      return;
    }

    const currentCol = currentDef[0];
    console.log(`  Current type: ${currentCol.data_type}`);
    console.log(`  UDT name: ${currentCol.udt_name}`);
    console.log(`  Max length: ${currentCol.character_maximum_length || 'N/A'}`);
    console.log(`  Nullable: ${currentCol.is_nullable}\n`);

    // Step 2: Check if it's an ENUM
    if (currentCol.udt_name === 'registration_status') {
      // It's an ENUM, check if 'marketplace_purchased' is in the enum
      console.log("📊 Step 2: Checking ENUM values...");
      const [enumValues] = await db.query(`
        SELECT enumlabel
        FROM pg_enum
        WHERE enumtypid = (
          SELECT oid
          FROM pg_type
          WHERE typname = 'registration_status'
        )
        ORDER BY enumsortorder;
      `);

      const values = enumValues.map(v => v.enumlabel);
      console.log(`  Current ENUM values: ${values.join(", ")}`);

      if (!values.includes("marketplace_purchased")) {
        console.log("\n  ⚠️  'marketplace_purchased' not in ENUM. Adding it...");
        await db.query(`
          ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'marketplace_purchased';
        `);
        console.log("  ✅ Added 'marketplace_purchased' to ENUM");
      } else {
        console.log("  ✅ 'marketplace_purchased' already in ENUM");
      }
    } else {
      // It's VARCHAR, need to alter it
      console.log("📊 Step 2: Column is VARCHAR, checking size...");
      
      const currentSize = currentCol.character_maximum_length;
      const requiredSize = 50; // Enough for "marketplace_purchased" and future values

      if (!currentSize || currentSize < requiredSize) {
        console.log(`  Current size: VARCHAR(${currentSize || 'N/A'})`);
        console.log(`  Required size: VARCHAR(${requiredSize})`);
        console.log(`  Attempting to alter column...`);

        // First, try to convert to ENUM (better approach)
        try {
          // Create ENUM type if it doesn't exist
          await db.query(`
            DO $$ BEGIN
              CREATE TYPE registration_status AS ENUM (
                'allocated',
                'registered',
                'marketplace_purchased',
                'cancelled'
              );
            EXCEPTION
              WHEN duplicate_object THEN null;
            END $$;
          `);

          // Alter column to use ENUM
          await db.query(`
            ALTER TABLE course_reg
            ALTER COLUMN registration_status TYPE registration_status
            USING registration_status::registration_status;
          `);

          console.log("  ✅ Converted to ENUM type");
        } catch (enumError) {
          console.log("  ⚠️  Could not convert to ENUM, using VARCHAR instead...");
          console.log(`  Error: ${enumError.message}`);

          // Fallback: Just increase VARCHAR size
          await db.query(`
            ALTER TABLE course_reg
            ALTER COLUMN registration_status TYPE VARCHAR(${requiredSize});
          `);
          console.log(`  ✅ Altered to VARCHAR(${requiredSize})`);
        }
      } else {
        console.log(`  ✅ Already VARCHAR(${currentSize}) or larger`);
      }
    }

    // Step 3: Verify the change
    console.log("\n✅ Step 3: Verifying the change...");
    const [finalDef] = await db.query(`
      SELECT
        column_name,
        data_type,
        udt_name,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'course_reg'
        AND column_name = 'registration_status';
    `);

    if (finalDef.length > 0) {
      const finalCol = finalDef[0];
      console.log(`  Final type: ${finalCol.data_type}`);
      console.log(`  UDT name: ${finalCol.udt_name}`);
      console.log(`  Max length: ${finalCol.character_maximum_length || 'N/A'}`);
      
      if (finalCol.udt_name === 'registration_status') {
        // Check ENUM values
        const [finalEnumValues] = await db.query(`
          SELECT enumlabel
          FROM pg_enum
          WHERE enumtypid = (
            SELECT oid
            FROM pg_type
            WHERE typname = 'registration_status'
          )
          ORDER BY enumsortorder;
        `);
        console.log(`  ENUM values: ${finalEnumValues.map(v => v.enumlabel).join(", ")}`);
      }
    }

    console.log("\n============================================================");
    console.log("Migration complete!");
    console.log("============================================================\n");
    console.log("💡 The registration_status column should now accept 'marketplace_purchased'");

  } catch (error) {
    console.error("❌ Error during migration:", error);
    console.error("\nStack trace:", error.stack);
  } finally {
    await db.close();
  }
}

fixCourseRegRegistrationStatus();

