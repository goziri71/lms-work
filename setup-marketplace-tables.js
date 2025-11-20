import { connectDB, db } from "./src/database/database.js";
import {
  SoleTutor,
  Organization,
  OrganizationUser,
  MarketplaceTransaction,
  WspCommission,
} from "./src/models/marketplace/index.js";

/**
 * Setup Marketplace Tables
 * Creates tables for sole tutors, organizations, and organization users
 */
async function setupMarketplaceTables() {
  try {
    console.log("🔄 Connecting to database...");
    await connectDB();

    console.log("\n📋 Setting up Marketplace Tables...\n");

    // Check if tables exist
    const checkTable = async (tableName) => {
      const [result] = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${tableName}'
        )`
      );
      return result[0].exists;
    };

    // 1. Sole Tutors
    console.log("🔄 Checking sole_tutors table...");
    const soleTutorsExists = await checkTable("sole_tutors");
    if (!soleTutorsExists) {
      await SoleTutor.sync({ alter: false });
      console.log("   ✅ sole_tutors table created");
    } else {
      console.log("   ✅ sole_tutors table already exists");
    }

    // 2. Organizations
    console.log("🔄 Checking organizations table...");
    const organizationsExists = await checkTable("organizations");
    if (!organizationsExists) {
      await Organization.sync({ alter: false });
      console.log("   ✅ organizations table created");
    } else {
      console.log("   ✅ organizations table already exists");
    }

    // 3. Organization Users
    console.log("🔄 Checking organization_users table...");
    const orgUsersExists = await checkTable("organization_users");
    if (!orgUsersExists) {
      await OrganizationUser.sync({ alter: false });
      console.log("   ✅ organization_users table created");
    } else {
      console.log("   ✅ organization_users table already exists");
    }

    // 4. Marketplace Transactions
    console.log("🔄 Checking marketplace_transactions table...");
    const transactionsExists = await checkTable("marketplace_transactions");
    if (!transactionsExists) {
      await MarketplaceTransaction.sync({ alter: false });
      console.log("   ✅ marketplace_transactions table created");
    } else {
      console.log("   ✅ marketplace_transactions table already exists");
    }

    // 5. WSP Commissions
    console.log("🔄 Checking wsp_commissions table...");
    const commissionsExists = await checkTable("wsp_commissions");
    if (!commissionsExists) {
      await WspCommission.sync({ alter: false });
      console.log("   ✅ wsp_commissions table created");
    } else {
      console.log("   ✅ wsp_commissions table already exists");
    }

    // 6. Update courses table to add ownership fields
    console.log("\n🔄 Updating courses table for marketplace support...");
    try {
      await db.query(`
        DO $$ 
        BEGIN
          -- Add owner_type enum if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_courses_owner_type') THEN
            CREATE TYPE enum_courses_owner_type AS ENUM ('wsp', 'sole_tutor', 'organization');
          END IF;
        END $$;
      `);

      // Add columns if they don't exist
      await db.query(`
        ALTER TABLE courses 
        ADD COLUMN IF NOT EXISTS owner_type enum_courses_owner_type DEFAULT 'wsp' NOT NULL,
        ADD COLUMN IF NOT EXISTS owner_id INTEGER,
        ADD COLUMN IF NOT EXISTS is_marketplace BOOLEAN DEFAULT false NOT NULL,
        ADD COLUMN IF NOT EXISTS marketplace_status VARCHAR(20);
      `);

      console.log("   ✅ courses table updated with ownership fields");
    } catch (error) {
      if (error.message.includes("already exists") || error.message.includes("duplicate")) {
        console.log("   ✅ courses table already has ownership fields");
      } else {
        throw error;
      }
    }

    console.log("\n✅ Marketplace tables setup completed!");
    console.log("\n📝 Next Steps:");
    console.log("   1. Set up associations");
    console.log("   2. Create tutor authentication");
    console.log("   3. Build Super Admin tutor management");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting up marketplace tables:", error);
    process.exit(1);
  }
}

setupMarketplaceTables();

