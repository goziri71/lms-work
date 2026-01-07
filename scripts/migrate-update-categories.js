/**
 * Migration Script: Update Categories to New Standard
 *
 * This script updates all existing category values to the new 6-category system:
 * - Business & Management
 * - Technology & Data
 * - Engineering & Physical Science
 * - Health & Medicine
 * - Arts & Humanities
 * - Personal Development & Education
 *
 * Run: node scripts/migrate-update-categories.js
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { db } from "../src/database/database.js";

dotenv.config();

// Mapping old categories to new categories
const categoryMapping = {
  // Old categories -> New categories
  Business: "Business & Management",
  Tech: "Technology & Data",
  Art: "Arts & Humanities",
  Logistics: "Business & Management", // Logistics -> Business & Management
  Ebooks: "Personal Development & Education",
  Podcast: "Personal Development & Education",
  Videos: "Personal Development & Education",
  Music: "Arts & Humanities",
  musical: "Arts & Humanities", // Handle lowercase variant
  Articles: "Personal Development & Education",
  Code: "Technology & Data",
  "2D/3D Files": "Technology & Data",
};

async function migrateCategories() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("📦 Starting migration: Update Categories to New Standard\n");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    const dialect = db.getDialect();
    const isPostgres = dialect === "postgres";

    const newCategories = [
      "Business & Management",
      "Technology & Data",
      "Engineering & Physical Science",
      "Health & Medicine",
      "Arts & Humanities",
      "Personal Development & Education",
    ];

    // Step 0: Drop existing CHECK constraints for PostgreSQL (before data update)
    if (isPostgres) {
      console.log(
        "🔍 Step 0: Dropping existing CHECK constraints for PostgreSQL...\n"
      );

      const tables = [
        "courses",
        "digital_downloads",
        "coaching_sessions",
        "communities",
      ];

      for (const tableName of tables) {
        try {
          // Find existing constraint on category column
          const constraints = await db.query(
            `SELECT conname 
             FROM pg_constraint c
             JOIN pg_class t ON c.conrelid = t.oid
             WHERE t.relname = :tableName
             AND c.contype = 'c'
             AND c.conname LIKE '%category%'`,
            {
              replacements: { tableName },
              type: db.QueryTypes.SELECT,
            }
          );

          // Drop existing category constraints
          if (constraints && constraints.length > 0) {
            for (const constraint of constraints) {
              if (constraint && constraint.conname) {
                console.log(
                  `  🔄 Dropping constraint ${constraint.conname} from ${tableName}...`
                );
                await db.query(
                  `ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${constraint.conname}`
                );
                console.log(`  ✓ Dropped constraint ${constraint.conname}`);
              }
            }
          } else {
            // Try dropping with standard naming pattern
            const standardName = `${tableName}_category_check`;
            console.log(
              `  🔄 Attempting to drop constraint ${standardName}...`
            );
            await db.query(
              `ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${standardName}`
            );
          }
          console.log(`  ✓ ${tableName} constraints dropped\n`);
        } catch (error) {
          console.log(
            `  ⚠️  Could not drop constraints for ${tableName}: ${error.message}\n`
          );
        }
      }
    }

    // Step 1: Update courses table
    console.log("🔍 Step 1: Updating 'courses' table...");
    let coursesUpdated = 0;

    for (const [oldCategory, newCategory] of Object.entries(categoryMapping)) {
      const query = isPostgres
        ? `UPDATE courses SET category = :newCategory WHERE category = :oldCategory`
        : `UPDATE courses SET category = :newCategory WHERE category = :oldCategory`;

      const result = await db.query(query, {
        replacements: { newCategory, oldCategory },
      });

      // For PostgreSQL: result is [rows, metadata] where metadata.rowCount is the count
      // For MySQL: result is [rows, metadata] where metadata.affectedRows is the count
      const count = isPostgres
        ? Array.isArray(result) && result[1]?.rowCount
          ? result[1].rowCount
          : 0
        : Array.isArray(result) && result[1]?.affectedRows
        ? result[1].affectedRows
        : 0;
      if (count > 0) {
        console.log(
          `  ✓ Updated ${count} course(s) from "${oldCategory}" to "${newCategory}"`
        );
        coursesUpdated += count;
      }
    }
    console.log(`✅ Updated ${coursesUpdated} course(s) total\n`);

    // Step 2: Update digital_downloads table
    console.log("🔍 Step 2: Updating 'digital_downloads' table...");
    let downloadsUpdated = 0;

    for (const [oldCategory, newCategory] of Object.entries(categoryMapping)) {
      const query = isPostgres
        ? `UPDATE digital_downloads SET category = :newCategory WHERE category = :oldCategory`
        : `UPDATE digital_downloads SET category = :newCategory WHERE category = :oldCategory`;

      const result = await db.query(query, {
        replacements: { newCategory, oldCategory },
      });

      // For PostgreSQL: result is [rows, metadata] where metadata.rowCount is the count
      // For MySQL: result is [rows, metadata] where metadata.affectedRows is the count
      const count = isPostgres
        ? Array.isArray(result) && result[1]?.rowCount
          ? result[1].rowCount
          : 0
        : Array.isArray(result) && result[1]?.affectedRows
        ? result[1].affectedRows
        : 0;
      if (count > 0) {
        console.log(
          `  ✓ Updated ${count} digital download(s) from "${oldCategory}" to "${newCategory}"`
        );
        downloadsUpdated += count;
      }
    }
    console.log(`✅ Updated ${downloadsUpdated} digital download(s) total\n`);

    // Step 3: Update coaching_sessions table
    console.log("🔍 Step 3: Updating 'coaching_sessions' table...");
    let sessionsUpdated = 0;

    for (const [oldCategory, newCategory] of Object.entries(categoryMapping)) {
      const query = isPostgres
        ? `UPDATE coaching_sessions SET category = :newCategory WHERE category = :oldCategory`
        : `UPDATE coaching_sessions SET category = :newCategory WHERE category = :oldCategory`;

      const result = await db.query(query, {
        replacements: { newCategory, oldCategory },
      });

      // For PostgreSQL: result is [rows, metadata] where metadata.rowCount is the count
      // For MySQL: result is [rows, metadata] where metadata.affectedRows is the count
      const count = isPostgres
        ? Array.isArray(result) && result[1]?.rowCount
          ? result[1].rowCount
          : 0
        : Array.isArray(result) && result[1]?.affectedRows
        ? result[1].affectedRows
        : 0;
      if (count > 0) {
        console.log(
          `  ✓ Updated ${count} coaching session(s) from "${oldCategory}" to "${newCategory}"`
        );
        sessionsUpdated += count;
      }
    }
    console.log(`✅ Updated ${sessionsUpdated} coaching session(s) total\n`);

    // Step 4: Update communities table
    console.log("🔍 Step 4: Updating 'communities' table...");
    let communitiesUpdated = 0;

    for (const [oldCategory, newCategory] of Object.entries(categoryMapping)) {
      const query = isPostgres
        ? `UPDATE communities SET category = :newCategory WHERE category = :oldCategory`
        : `UPDATE communities SET category = :newCategory WHERE category = :oldCategory`;

      const result = await db.query(query, {
        replacements: { newCategory, oldCategory },
      });

      // For PostgreSQL: result is [rows, metadata] where metadata.rowCount is the count
      // For MySQL: result is [rows, metadata] where metadata.affectedRows is the count
      const count = isPostgres
        ? Array.isArray(result) && result[1]?.rowCount
          ? result[1].rowCount
          : 0
        : Array.isArray(result) && result[1]?.affectedRows
        ? result[1].affectedRows
        : 0;
      if (count > 0) {
        console.log(
          `  ✓ Updated ${count} communit(ies) from "${oldCategory}" to "${newCategory}"`
        );
        communitiesUpdated += count;
      }
    }
    console.log(`✅ Updated ${communitiesUpdated} communit(ies) total\n`);

    // Step 5: Check for unmapped categories
    console.log("🔍 Step 5: Checking for unmapped categories...");

    const tables = [
      "courses",
      "digital_downloads",
      "coaching_sessions",
      "communities",
    ];

    for (const table of tables) {
      const query = isPostgres
        ? `SELECT DISTINCT category FROM ${table} WHERE category IS NOT NULL AND category NOT IN (:cat1, :cat2, :cat3, :cat4, :cat5, :cat6)`
        : `SELECT DISTINCT category FROM ${table} WHERE category IS NOT NULL AND category NOT IN (:cat1, :cat2, :cat3, :cat4, :cat5, :cat6)`;

      const unmapped = await db.query(query, {
        replacements: {
          cat1: newCategories[0],
          cat2: newCategories[1],
          cat3: newCategories[2],
          cat4: newCategories[3],
          cat5: newCategories[4],
          cat6: newCategories[5],
        },
        type: db.QueryTypes.SELECT,
      });

      if (unmapped && unmapped.length > 0) {
        console.log(
          `  ⚠️  ${table}: Found ${unmapped.length} unmapped category value(s):`
        );
        unmapped.forEach((row) => {
          console.log(`     - "${row.category}" (will need manual update)`);
        });
      } else {
        console.log(`  ✓ ${table}: All categories mapped`);
      }
    }

    // Step 6: Re-add CHECK constraints after data migration (PostgreSQL only)
    if (isPostgres) {
      console.log(
        "\n🔍 Step 6: Re-adding CHECK constraints for PostgreSQL...\n"
      );

      const tables = [
        "courses",
        "digital_downloads",
        "coaching_sessions",
        "communities",
      ];

      for (const tableName of tables) {
        try {
          // Check if constraint already exists
          const [constraintExists] = await db.query(
            `SELECT EXISTS (
              SELECT 1 FROM pg_constraint c
              JOIN pg_class t ON c.conrelid = t.oid
              WHERE t.relname = :tableName
              AND c.conname = :constraintName
            ) as exists`,
            {
              replacements: {
                tableName,
                constraintName: `${tableName}_category_check`,
              },
              type: db.QueryTypes.SELECT,
            }
          );

          if (constraintExists && !constraintExists.exists) {
            // Add new constraint with new categories
            const categoryList = newCategories
              .map((cat) => `'${cat.replace(/'/g, "''")}'`)
              .join(", ");
            const constraintName = `${tableName}_category_check`;
            console.log(`  🔄 Adding constraint for ${tableName}...`);
            await db.query(
              `ALTER TABLE ${tableName} 
               ADD CONSTRAINT ${constraintName} 
               CHECK (category IS NULL OR category IN (${categoryList}))`
            );
            console.log(`  ✓ Added constraint for ${tableName}\n`);
          } else {
            console.log(`  ✓ Constraint already exists for ${tableName}\n`);
          }
        } catch (error) {
          console.log(
            `  ⚠️  Could not add constraint for ${tableName}: ${error.message}\n`
          );
        }
      }
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - Courses updated: ${coursesUpdated}`);
    console.log(`   - Digital downloads updated: ${downloadsUpdated}`);
    console.log(`   - Coaching sessions updated: ${sessionsUpdated}`);
    console.log(`   - Communities updated: ${communitiesUpdated}`);
    console.log(
      "\n⚠️  Note: If any unmapped categories were found, they will need to be manually updated."
    );
    console.log("   The new categories are:");
    newCategories.forEach((cat) => console.log(`     - ${cat}`));

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateCategories();
