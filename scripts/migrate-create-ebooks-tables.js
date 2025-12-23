import { db } from "../src/database/database.js";
import { EBooks, EBookPurchase } from "../src/models/marketplace/index.js";

/**
 * Migration: Create ebooks and ebook_purchases tables
 *
 * This script creates the necessary tables for the e-book marketplace feature:
 * - ebooks: Stores e-book information (title, author, price, PDF URL, etc.)
 * - ebook_purchases: Tracks student purchases of e-books
 */
async function migrateCreateEBooksTables() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");

    console.log(
      "\n📦 Starting migration: Create ebooks and ebook_purchases tables"
    );
    console.log("Database dialect:", db.getDialect());

    // Check if ebooks table exists
    const [ebooksTableExists] = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ebooks'
      ) as exists;
    `);

    if (ebooksTableExists[0].exists) {
      console.log("⚠️  Table 'ebooks' already exists. Skipping creation.");
    } else {
      console.log("📝 Creating 'ebooks' table...");

      await db.query(`
        CREATE TABLE ebooks (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          author VARCHAR(200),
          pages INTEGER,
          price DECIMAL(10, 2) NOT NULL DEFAULT 0,
          currency VARCHAR(5) NOT NULL DEFAULT 'NGN',
          pdf_url TEXT NOT NULL,
          cover_image TEXT,
          category VARCHAR(100),
          tags TEXT[] DEFAULT '{}',
          owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('sole_tutor', 'organization')),
          owner_id INTEGER NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
          sales_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_ebooks_owner ON ebooks(owner_type, owner_id);
        CREATE INDEX idx_ebooks_status ON ebooks(status);
        CREATE INDEX idx_ebooks_category ON ebooks(category);
      `);

      console.log("✅ Table 'ebooks' created successfully with indexes.");
    }

    // Check if ebook_purchases table exists
    const [purchasesTableExists] = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ebook_purchases'
      ) as exists;
    `);

    if (purchasesTableExists[0].exists) {
      console.log(
        "⚠️  Table 'ebook_purchases' already exists. Skipping creation."
      );
    } else {
      console.log("📝 Creating 'ebook_purchases' table...");

      await db.query(`
        CREATE TABLE ebook_purchases (
          id SERIAL PRIMARY KEY,
          ebook_id INTEGER NOT NULL,
          student_id INTEGER NOT NULL,
          owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('sole_tutor', 'organization')),
          owner_id INTEGER NOT NULL,
          price DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(5) NOT NULL DEFAULT 'NGN',
          commission_rate DECIMAL(5, 2) NOT NULL,
          wsp_commission DECIMAL(10, 2) NOT NULL,
          tutor_earnings DECIMAL(10, 2) NOT NULL,
          transaction_ref VARCHAR(100) NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_ebook_purchases_student 
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
          CONSTRAINT fk_ebook_purchases_ebook 
            FOREIGN KEY (ebook_id) REFERENCES ebooks(id) ON DELETE CASCADE
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_ebook_purchases_student ON ebook_purchases(student_id);
        CREATE INDEX idx_ebook_purchases_ebook ON ebook_purchases(ebook_id);
        CREATE INDEX idx_ebook_purchases_owner ON ebook_purchases(owner_type, owner_id);
        CREATE UNIQUE INDEX idx_ebook_purchases_transaction_ref ON ebook_purchases(transaction_ref);
      `);

      console.log(
        "✅ Table 'ebook_purchases' created successfully with indexes."
      );
    }

    console.log("\n✅ Migration completed successfully.");
    console.log("\n📋 Summary:");
    console.log("   - ebooks table: Ready for e-book management");
    console.log("   - ebook_purchases table: Ready for purchase tracking");
    console.log("\n💡 Next steps:");
    console.log("   1. Tutors can now create e-books via API");
    console.log("   2. Students can browse and purchase e-books");
    console.log("   3. PDF files should be uploaded to Supabase storage");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run migration
migrateCreateEBooksTables();
