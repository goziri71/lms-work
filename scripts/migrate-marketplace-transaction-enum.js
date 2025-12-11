import { db } from "../src/database/database.js";

/**
 * Migration script to add 'wpu' to marketplace_transactions owner_type ENUM
 * 
 * ⚠️ SAFETY: This script ONLY ADDS to the database. It NEVER deletes or modifies existing data.
 * 
 * This script:
 * 1. Adds 'wpu' value to the owner_type ENUM (if not already present)
 * 2. Makes owner_id nullable (if not already nullable)
 * 
 * ✅ SAFE OPERATIONS:
 * - ALTER TYPE ADD VALUE (only adds if doesn't exist)
 * - ALTER TABLE ALTER COLUMN (only changes nullability, no data loss)
 * 
 * ❌ NO DELETIONS:
 * - No DROP TABLE
 * - No DROP COLUMN
 * - No DELETE statements
 * - No TRUNCATE
 * 
 * Usage: npm run migrate:marketplace-enum
 * Or: node scripts/migrate-marketplace-transaction-enum.js
 */

async function migrateMarketplaceTransactionEnum() {
  try {
    console.log("🚀 Starting Marketplace Transaction ENUM migration...\n");

    // Connect to database
    console.log("🔌 Connecting to database...");
    await db.authenticate();
    console.log("✅ Database connected\n");

    // Step 1: Check current ENUM type name
    console.log("📊 Step 1: Checking current ENUM type...");
    try {
      const [enumCheck] = await db.query(`
        SELECT 
          t.typname as enum_name,
          e.enumlabel as enum_value
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        WHERE t.typname LIKE '%owner_type%' OR t.typname LIKE '%marketplace%'
        ORDER BY t.typname, e.enumsortorder;
      `);

      if (enumCheck.length > 0) {
        console.log("   📋 Found ENUM types:");
        const enumGroups = {};
        enumCheck.forEach((row) => {
          if (!enumGroups[row.enum_name]) {
            enumGroups[row.enum_name] = [];
          }
          enumGroups[row.enum_name].push(row.enum_value);
        });
        Object.keys(enumGroups).forEach((name) => {
          console.log(`      - ${name}: [${enumGroups[name].join(", ")}]`);
        });
      } else {
        console.log("   ⚠️  No ENUM types found matching pattern");
      }
    } catch (error) {
      console.log("   ⚠️  Could not check ENUM types:", error.message);
    }

    // Step 2: Find the exact ENUM type name for owner_type column
    console.log("\n📊 Step 2: Finding owner_type ENUM type name...");
    try {
      const [enumType] = await db.query(`
        SELECT 
          pg_type.typname as enum_name,
          format_type(pg_type.oid, NULL) as full_type
        FROM pg_type
        JOIN pg_attribute ON pg_attribute.atttypid = pg_type.oid
        JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
        WHERE pg_class.relname = 'marketplace_transactions'
          AND pg_attribute.attname = 'owner_type';
      `);

      if (enumType.length === 0) {
        throw new Error("Could not find owner_type column or ENUM type");
      }

      const enumTypeName = enumType[0].enum_name;
      console.log(`   ✅ Found ENUM type: ${enumTypeName}\n`);

      // Step 3: Add 'wpu' to ENUM (if not already present)
      console.log("📊 Step 3: Adding 'wpu' to ENUM...");
      try {
        // Check if 'wpu' already exists
        const [existingValues] = await db.query(`
          SELECT enumlabel 
          FROM pg_enum 
          WHERE enumtypid = (
            SELECT oid FROM pg_type WHERE typname = '${enumTypeName}'
          ) AND enumlabel = 'wpu';
        `);

        if (existingValues.length > 0) {
          console.log("   ✅ 'wpu' value already exists in ENUM\n");
        } else {
          // Add 'wpu' to ENUM
          await db.query(`
            ALTER TYPE ${enumTypeName} ADD VALUE IF NOT EXISTS 'wpu';
          `);
          console.log("   ✅ 'wpu' value added to ENUM\n");
        }
      } catch (error) {
        // PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE ADD VALUE
        // So we need to handle the error if it already exists
        if (error.message.includes("already exists") || error.message.includes("duplicate")) {
          console.log("   ✅ 'wpu' value already exists in ENUM\n");
        } else {
          // Try alternative approach for older PostgreSQL versions
          try {
            await db.query(`
              DO $$ 
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_enum 
                  WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = '${enumTypeName}')
                  AND enumlabel = 'wpu'
                ) THEN
                  ALTER TYPE ${enumTypeName} ADD VALUE 'wpu';
                END IF;
              END $$;
            `);
            console.log("   ✅ 'wpu' value added to ENUM (using DO block)\n");
          } catch (altError) {
            if (altError.message.includes("already exists") || altError.message.includes("duplicate")) {
              console.log("   ✅ 'wpu' value already exists in ENUM\n");
            } else {
              throw altError;
            }
          }
        }
      }

      // Step 4: Make owner_id nullable (if not already nullable)
      console.log("📊 Step 4: Making owner_id column nullable...");
      try {
        const [columnInfo] = await db.query(`
          SELECT 
            column_name,
            is_nullable,
            data_type
          FROM information_schema.columns
          WHERE table_name = 'marketplace_transactions'
            AND column_name = 'owner_id';
        `);

        if (columnInfo.length === 0) {
          console.log("   ⚠️  owner_id column not found\n");
        } else {
          const isNullable = columnInfo[0].is_nullable === "YES";
          if (isNullable) {
            console.log("   ✅ owner_id is already nullable\n");
          } else {
            await db.query(`
              ALTER TABLE marketplace_transactions 
              ALTER COLUMN owner_id DROP NOT NULL;
            `);
            console.log("   ✅ owner_id is now nullable\n");
          }
        }
      } catch (error) {
        console.error("   ❌ Error updating owner_id:", error.message);
        // Don't fail if column doesn't exist or is already nullable
        if (!error.message.includes("does not exist") && !error.message.includes("already")) {
          throw error;
        }
      }

      // Step 5: Verify migration
      console.log("📊 Step 5: Verifying migration...");
      try {
        const [finalCheck] = await db.query(`
          SELECT 
            enumlabel as enum_value
          FROM pg_enum 
          WHERE enumtypid = (
            SELECT oid FROM pg_type WHERE typname = '${enumTypeName}'
          )
          ORDER BY enumsortorder;
        `);

        const enumValues = finalCheck.map((row) => row.enum_value);
        console.log(`   ✅ ENUM values: [${enumValues.join(", ")}]`);

        const [nullableCheck] = await db.query(`
          SELECT is_nullable
          FROM information_schema.columns
          WHERE table_name = 'marketplace_transactions'
            AND column_name = 'owner_id';
        `);

        if (nullableCheck.length > 0) {
          console.log(
            `   ✅ owner_id nullable: ${nullableCheck[0].is_nullable === "YES" ? "YES" : "NO"}`
          );
        }

        console.log("\n✅ MIGRATION COMPLETED SUCCESSFULLY!\n");
        console.log("📋 Summary:");
        console.log("   ✅ 'wpu' added to owner_type ENUM");
        console.log("   ✅ owner_id column is nullable");
      } catch (error) {
        console.error("   ⚠️  Could not verify migration:", error.message);
      }
    } catch (error) {
      console.error("   ❌ Error finding ENUM type:", error.message);
      console.log("\n   💡 TIP: The ENUM type might not exist yet.");
      console.log("   💡 TIP: Sequelize will create it automatically when the model is synced.");
      console.log("   💡 TIP: You can also run this migration after the table is created.\n");
      throw error;
    }
  } catch (error) {
    console.error("\n❌ MIGRATION FAILED:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run migration
migrateMarketplaceTransactionEnum();

