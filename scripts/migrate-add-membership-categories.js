import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to add new categories to memberships table
 * 
 * Adds:
 * - "Religious and Faith"
 * - "Social and Impact"
 * 
 * Run with: node scripts/migrate-add-membership-categories.js
 */

async function addMembershipCategories() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Add Membership Categories\n");

    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    if (dialect !== 'postgres') {
      console.log("⚠️  This migration is designed for PostgreSQL. Skipping...");
      process.exit(0);
    }

    // Step 1: Drop existing category CHECK constraint
    console.log("🔍 Step 1: Dropping existing category CHECK constraint...");
    try {
      // Find the constraint name
      const [constraints] = await db.query(
        `SELECT conname 
         FROM pg_constraint c
         JOIN pg_class t ON c.conrelid = t.oid
         WHERE t.relname = 'memberships'
         AND c.contype = 'c'
         AND c.conname LIKE '%category%'`,
        { type: QueryTypes.SELECT }
      );

      if (constraints && constraints.length > 0) {
        for (const constraint of constraints) {
          if (constraint && constraint.conname) {
            console.log(`  🔄 Dropping constraint: ${constraint.conname}`);
            await db.query(
              `ALTER TABLE memberships DROP CONSTRAINT IF EXISTS ${constraint.conname}`
            );
            console.log(`  ✅ Dropped constraint: ${constraint.conname}`);
          }
        }
      } else {
        // Try standard naming
        const standardName = "memberships_category_check";
        console.log(`  🔄 Attempting to drop constraint: ${standardName}`);
        await db.query(
          `ALTER TABLE memberships DROP CONSTRAINT IF EXISTS ${standardName}`
        );
        console.log(`  ✅ Dropped constraint: ${standardName}`);
      }
    } catch (error) {
      if (error.message.includes("does not exist") || error.message.includes("not found")) {
        console.log("  ⚠️  No existing constraint found (may have been dropped already)");
      } else {
        throw error;
      }
    }

    // Step 2: Add new CHECK constraint with updated categories
    console.log("\n🔍 Step 2: Adding updated category CHECK constraint...");
    await db.query(`
      ALTER TABLE memberships 
      ADD CONSTRAINT memberships_category_check 
      CHECK (category IS NULL OR category IN (
        'Business & Management',
        'Technology & Data',
        'Engineering & Physical Science',
        'Health & Medicine',
        'Arts & Humanities',
        'Personal Development & Education',
        'Religious and Faith',
        'Social and Impact'
      ))
    `);
    console.log("✅ Updated category CHECK constraint added successfully.\n");

    console.log("✅ Migration completed successfully!");
    console.log("\n📋 Summary:");
    console.log("   - Added 'Religious and Faith' category");
    console.log("   - Added 'Social and Impact' category");
    console.log("\n✨ Membership categories updated!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Run migration
addMembershipCategories();
