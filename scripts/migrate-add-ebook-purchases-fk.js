import { db } from "../src/database/database.js";

/**
 * Migration: Add missing foreign key constraint for ebook_id in ebook_purchases table
 */
async function migrateAddEBookPurchasesFK() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");

    console.log("\n📦 Starting migration: Add foreign key constraint for ebook_id");
    console.log("Database dialect:", db.getDialect());

    // Check if foreign key already exists
    const [fkExists] = await db.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'ebook_purchases'
          AND kcu.column_name = 'ebook_id'
      ) as exists;
    `);

    if (fkExists[0].exists) {
      console.log("✅ Foreign key constraint for ebook_id already exists. Skipping.");
    } else {
      console.log("📝 Adding foreign key constraint for ebook_id...");

      // Check if ebooks table exists first
      const [ebooksTableExists] = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'ebooks'
        ) as exists;
      `);

      if (!ebooksTableExists[0].exists) {
        console.log("❌ Table 'ebooks' does not exist. Cannot add foreign key.");
        throw new Error("ebooks table must exist before adding foreign key");
      }

      // Add foreign key constraint
      await db.query(`
        ALTER TABLE ebook_purchases
        ADD CONSTRAINT fk_ebook_purchases_ebook 
        FOREIGN KEY (ebook_id) REFERENCES ebooks(id) ON DELETE CASCADE;
      `);

      console.log("✅ Foreign key constraint added successfully.");
    }

    console.log("\n✅ Migration completed successfully.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run migration
migrateAddEBookPurchasesFK();

