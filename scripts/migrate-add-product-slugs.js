/**
 * Migration: Add slug fields to product tables
 * Adds slug column to: courses, ebooks, digital_downloads, communities, memberships
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function addProductSlugs() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Product Slugs");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    const dialect = db.getDialect();

    // Tables to add slug to
    const productTables = [
      { name: "courses", titleField: "title" },
      { name: "ebooks", titleField: "title" },
      { name: "digital_downloads", titleField: "title" },
      { name: "communities", titleField: "name" },
      { name: "memberships", titleField: "name" },
    ];

    for (const table of productTables) {
      console.log(`🔍 Step: Adding 'slug' column to '${table.name}' table...`);

      // Check if column already exists
      const [columnExists] = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = '${table.name}' 
          AND column_name = 'slug'
        ) as exists;`,
        { type: QueryTypes.SELECT }
      );

      if (columnExists.exists) {
        console.log(`   ⏭️  'slug' column already exists in '${table.name}'. Skipping...`);
      } else {
        // Add slug column
        await db.query(
          `ALTER TABLE ${table.name} 
           ADD COLUMN slug VARCHAR(255) UNIQUE;`
        );
        console.log(`   ✅ Added 'slug' column to '${table.name}'.`);

        // Create index on slug for faster lookups
        try {
          await db.query(
            `CREATE INDEX idx_${table.name}_slug ON ${table.name}(slug);`
          );
          console.log(`   ✅ Created index on 'slug' column in '${table.name}'.`);
        } catch (error) {
          // Index might already exist or unique constraint already creates one
          console.log(`   ⚠️  Index creation skipped (may already exist).`);
        }
      }

      // Generate slugs for existing records that don't have one
      console.log(`   🔄 Generating slugs for existing records in '${table.name}'...`);
      
      const records = await db.query(
        `SELECT id, ${table.titleField} FROM ${table.name} WHERE slug IS NULL OR slug = '';`,
        { type: QueryTypes.SELECT }
      );

      if (records.length > 0) {
        console.log(`   📝 Found ${records.length} records without slugs.`);
        console.log(`   ⏳ Processing... (this may take a moment for large datasets)`);

        let processed = 0;
        const total = records.length;
        const progressInterval = Math.max(1, Math.floor(total / 20)); // Show progress every 5%

        for (const record of records) {
          const title = record[table.titleField] || `product-${record.id}`;
          let slug = title
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^\w\-]+/g, "")
            .replace(/\-\-+/g, "-")
            .replace(/^-+/, "")
            .replace(/-+$/, "");

          if (!slug) {
            slug = `${table.name}-${record.id}`;
          }

          // Ensure uniqueness
          let uniqueSlug = slug;
          let counter = 1;
          while (true) {
            const [existing] = await db.query(
              `SELECT id FROM ${table.name} WHERE slug = :slug AND id != :id LIMIT 1;`,
              {
                replacements: { slug: uniqueSlug, id: record.id },
                type: QueryTypes.SELECT,
              }
            );

            if (!existing) {
              break;
            }
            uniqueSlug = `${slug}-${counter}`;
            counter++;
          }

          await db.query(
            `UPDATE ${table.name} SET slug = :slug WHERE id = :id;`,
            {
              replacements: { slug: uniqueSlug, id: record.id },
            }
          );

          processed++;
          
          // Show progress
          if (processed % progressInterval === 0 || processed === total) {
            const percentage = Math.round((processed / total) * 100);
            process.stdout.write(`\r   📊 Progress: ${processed}/${total} (${percentage}%)`);
          }
        }

        console.log(`\n   ✅ Generated slugs for ${records.length} records.`);
      } else {
        console.log(`   ✅ All records already have slugs.`);
      }

      console.log("");
    }

    console.log("✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update product models to include slug field");
    console.log("   2. Update product creation/update controllers to auto-generate slugs");
    console.log("   3. Create public product page route (/p/:slug)");
    console.log("   4. Test product links\n");

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

addProductSlugs();
