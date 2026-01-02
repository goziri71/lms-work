import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to transform ebooks system to digital downloads
 * 
 * This script:
 * 1. Creates new digital_downloads table with all new fields
 * 2. Migrates all existing ebook data (sets product_type = 'ebook')
 * 3. Creates new digital_download_purchases table
 * 4. Migrates all existing ebook_purchases data
 * 5. Updates foreign keys
 * 6. Keeps old tables for rollback (can be removed later)
 * 
 * Run with: node scripts/migrate-ebooks-to-digital-downloads.js
 */

async function migrateEbooksToDigitalDownloads() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Ebooks to Digital Downloads\n");

    const dialect = db.getDialect();
    console.log(`Database dialect: ${dialect}\n`);

    // Step 1: Check if ebooks table exists
    console.log("🔍 Step 1: Checking existing tables...");
    const [ebooksTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ebooks'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    const [purchasesTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ebook_purchases'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!ebooksTableExists.exists) {
      console.log("⚠️  'ebooks' table does not exist. Nothing to migrate.");
      console.log("   Run 'migrate-create-ebooks-tables.js' first if you want to create sample data.");
      process.exit(0);
    }

    console.log("   ✅ Found 'ebooks' table");
    console.log(`   ${purchasesTableExists.exists ? '✅' : '⚠️ '} Found 'ebook_purchases' table\n`);

    // Step 2: Create digital_downloads table
    console.log("🔍 Step 2: Creating 'digital_downloads' table...");
    const [digitalDownloadsExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'digital_downloads'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!digitalDownloadsExists.exists) {
      console.log("   📝 Creating 'digital_downloads' table...");

      if (dialect === 'postgres') {
        await db.query(`
          CREATE TABLE digital_downloads (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            author VARCHAR(200),
            pages INTEGER,
            price DECIMAL(10, 2) NOT NULL DEFAULT 0,
            currency VARCHAR(5) NOT NULL DEFAULT 'NGN',
            file_url TEXT NOT NULL,
            file_type VARCHAR(50),
            file_size BIGINT,
            cover_image TEXT,
            preview_url TEXT,
            category VARCHAR(100),
            tags TEXT[] DEFAULT '{}',
            product_type VARCHAR(20) NOT NULL DEFAULT 'ebook' 
              CHECK (product_type IN ('ebook', 'podcast', 'video', 'music', 'art', 'article', 'code', '2d_3d_files')),
            owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('sole_tutor', 'organization')),
            owner_id INTEGER NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
            sales_count INTEGER NOT NULL DEFAULT 0,
            duration INTEGER,
            dimensions VARCHAR(50),
            resolution VARCHAR(50),
            streaming_enabled BOOLEAN DEFAULT false,
            download_enabled BOOLEAN DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Create indexes
        await db.query(`
          CREATE INDEX idx_digital_downloads_owner ON digital_downloads(owner_type, owner_id);
          CREATE INDEX idx_digital_downloads_status ON digital_downloads(status);
          CREATE INDEX idx_digital_downloads_category ON digital_downloads(category);
          CREATE INDEX idx_digital_downloads_product_type ON digital_downloads(product_type);
        `);
      } else if (dialect === 'mysql' || dialect === 'mariadb') {
        await db.query(`
          CREATE TABLE digital_downloads (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            author VARCHAR(200),
            pages INT,
            price DECIMAL(10, 2) NOT NULL DEFAULT 0,
            currency VARCHAR(5) NOT NULL DEFAULT 'NGN',
            file_url TEXT NOT NULL,
            file_type VARCHAR(50),
            file_size BIGINT,
            cover_image TEXT,
            preview_url TEXT,
            category VARCHAR(100),
            tags JSON,
            product_type VARCHAR(20) NOT NULL DEFAULT 'ebook',
            owner_type VARCHAR(20) NOT NULL,
            owner_id INT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            sales_count INT NOT NULL DEFAULT 0,
            duration INT,
            dimensions VARCHAR(50),
            resolution VARCHAR(50),
            streaming_enabled BOOLEAN DEFAULT false,
            download_enabled BOOLEAN DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CHECK (product_type IN ('ebook', 'podcast', 'video', 'music', 'art', 'article', 'code', '2d_3d_files')),
            CHECK (owner_type IN ('sole_tutor', 'organization')),
            CHECK (status IN ('draft', 'published'))
          );
        `);

        // Create indexes
        await db.query(`
          CREATE INDEX idx_digital_downloads_owner ON digital_downloads(owner_type, owner_id);
          CREATE INDEX idx_digital_downloads_status ON digital_downloads(status);
          CREATE INDEX idx_digital_downloads_category ON digital_downloads(category);
          CREATE INDEX idx_digital_downloads_product_type ON digital_downloads(product_type);
        `);
      }

      console.log("   ✅ Table 'digital_downloads' created successfully\n");
    } else {
      console.log("   ⚠️  Table 'digital_downloads' already exists. Skipping creation.\n");
    }

    // Step 3: Migrate ebook data to digital_downloads
    console.log("🔍 Step 3: Migrating ebook data...");
    const [ebookCount] = await db.query(
      `SELECT COUNT(*) as count FROM ebooks`,
      { type: QueryTypes.SELECT }
    );

    if (ebookCount.count > 0) {
      console.log(`   📝 Migrating ${ebookCount.count} ebooks...`);

      if (dialect === 'postgres') {
        await db.query(`
          INSERT INTO digital_downloads (
            id, title, description, author, pages, price, currency,
            file_url, cover_image, category, tags,
            owner_type, owner_id, status, sales_count,
            product_type, file_type, download_enabled, streaming_enabled,
            created_at, updated_at
          )
          SELECT 
            id, title, description, author, pages, price, currency,
            pdf_url as file_url, cover_image, category, tags,
            owner_type, owner_id, status, sales_count,
            'ebook' as product_type,
            'PDF' as file_type,
            true as download_enabled,
            false as streaming_enabled,
            created_at, updated_at
          FROM ebooks
          ON CONFLICT (id) DO NOTHING;
        `);
      } else if (dialect === 'mysql' || dialect === 'mariadb') {
        await db.query(`
          INSERT INTO digital_downloads (
            id, title, description, author, pages, price, currency,
            file_url, cover_image, category, tags,
            owner_type, owner_id, status, sales_count,
            product_type, file_type, download_enabled, streaming_enabled,
            created_at, updated_at
          )
          SELECT 
            id, title, description, author, pages, price, currency,
            pdf_url as file_url, cover_image, category, 
            CASE WHEN tags IS NULL THEN JSON_ARRAY() ELSE tags END as tags,
            owner_type, owner_id, status, sales_count,
            'ebook' as product_type,
            'PDF' as file_type,
            true as download_enabled,
            false as streaming_enabled,
            created_at, updated_at
          FROM ebooks
          ON DUPLICATE KEY UPDATE id=id;
        `);
      }

      console.log("   ✅ Ebook data migrated successfully\n");
    } else {
      console.log("   ⚠️  No ebooks to migrate\n");
    }

    // Step 4: Create digital_download_purchases table
    console.log("🔍 Step 4: Creating 'digital_download_purchases' table...");
    const [digitalPurchasesTableExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'digital_download_purchases'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (!digitalPurchasesTableExists.exists) {
      console.log("   📝 Creating 'digital_download_purchases' table...");

      if (dialect === 'postgres') {
        await db.query(`
          CREATE TABLE digital_download_purchases (
            id SERIAL PRIMARY KEY,
            digital_download_id INTEGER NOT NULL,
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
            CONSTRAINT fk_digital_download_purchases_student 
              FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            CONSTRAINT fk_digital_download_purchases_download 
              FOREIGN KEY (digital_download_id) REFERENCES digital_downloads(id) ON DELETE CASCADE
          );
        `);

        // Create indexes
        await db.query(`
          CREATE INDEX idx_digital_download_purchases_student ON digital_download_purchases(student_id);
          CREATE INDEX idx_digital_download_purchases_download ON digital_download_purchases(digital_download_id);
          CREATE INDEX idx_digital_download_purchases_owner ON digital_download_purchases(owner_type, owner_id);
          CREATE UNIQUE INDEX idx_digital_download_purchases_transaction_ref ON digital_download_purchases(transaction_ref);
        `);
      } else if (dialect === 'mysql' || dialect === 'mariadb') {
        await db.query(`
          CREATE TABLE digital_download_purchases (
            id INT AUTO_INCREMENT PRIMARY KEY,
            digital_download_id INT NOT NULL,
            student_id INT NOT NULL,
            owner_type VARCHAR(20) NOT NULL,
            owner_id INT NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            currency VARCHAR(5) NOT NULL DEFAULT 'NGN',
            commission_rate DECIMAL(5, 2) NOT NULL,
            wsp_commission DECIMAL(10, 2) NOT NULL,
            tutor_earnings DECIMAL(10, 2) NOT NULL,
            transaction_ref VARCHAR(100) NOT NULL UNIQUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_digital_download_purchases_student 
              FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            CONSTRAINT fk_digital_download_purchases_download 
              FOREIGN KEY (digital_download_id) REFERENCES digital_downloads(id) ON DELETE CASCADE,
            CHECK (owner_type IN ('sole_tutor', 'organization'))
          );
        `);

        // Create indexes
        await db.query(`
          CREATE INDEX idx_digital_download_purchases_student ON digital_download_purchases(student_id);
          CREATE INDEX idx_digital_download_purchases_download ON digital_download_purchases(digital_download_id);
          CREATE INDEX idx_digital_download_purchases_owner ON digital_download_purchases(owner_type, owner_id);
          CREATE UNIQUE INDEX idx_digital_download_purchases_transaction_ref ON digital_download_purchases(transaction_ref);
        `);
      }

      console.log("   ✅ Table 'digital_download_purchases' created successfully\n");
    } else {
      console.log("   ⚠️  Table 'digital_download_purchases' already exists. Skipping creation.\n");
    }

    // Step 5: Migrate ebook_purchases data
    if (purchasesTableExists.exists) {
      console.log("🔍 Step 5: Migrating purchase data...");
      const [purchaseCount] = await db.query(
        `SELECT COUNT(*) as count FROM ebook_purchases`,
        { type: QueryTypes.SELECT }
      );

      if (purchaseCount.count > 0) {
        console.log(`   📝 Migrating ${purchaseCount.count} purchases...`);

        if (dialect === 'postgres') {
          await db.query(`
            INSERT INTO digital_download_purchases (
              id, digital_download_id, student_id, owner_type, owner_id,
              price, currency, commission_rate, wsp_commission, tutor_earnings,
              transaction_ref, created_at
            )
            SELECT 
              id, ebook_id as digital_download_id, student_id, owner_type, owner_id,
              price, currency, commission_rate, wsp_commission, tutor_earnings,
              transaction_ref, created_at
            FROM ebook_purchases
            ON CONFLICT (id) DO NOTHING;
          `);
        } else if (dialect === 'mysql' || dialect === 'mariadb') {
          await db.query(`
            INSERT INTO digital_download_purchases (
              id, digital_download_id, student_id, owner_type, owner_id,
              price, currency, commission_rate, wsp_commission, tutor_earnings,
              transaction_ref, created_at
            )
            SELECT 
              id, ebook_id as digital_download_id, student_id, owner_type, owner_id,
              price, currency, commission_rate, wsp_commission, tutor_earnings,
              transaction_ref, created_at
            FROM ebook_purchases
            ON DUPLICATE KEY UPDATE id=id;
          `);
        }

        console.log("   ✅ Purchase data migrated successfully\n");
      } else {
        console.log("   ⚠️  No purchases to migrate\n");
      }
    }

    // Step 6: Verify migration
    console.log("🔍 Step 6: Verifying migration...");
    const [digitalDownloadsCount] = await db.query(
      `SELECT COUNT(*) as count FROM digital_downloads`,
      { type: QueryTypes.SELECT }
    );
    const [purchasesCount] = await db.query(
      `SELECT COUNT(*) as count FROM digital_download_purchases`,
      { type: QueryTypes.SELECT }
    );

    console.log(`   ✅ digital_downloads: ${digitalDownloadsCount.count} records`);
    console.log(`   ✅ digital_download_purchases: ${purchasesCount.count} records\n`);

    // Step 7: Update sequence/auto-increment if needed
    if (dialect === 'postgres') {
      console.log("🔍 Step 7: Updating sequences...");
      const [maxId] = await db.query(
        `SELECT COALESCE(MAX(id), 0) as max_id FROM digital_downloads`,
        { type: QueryTypes.SELECT }
      );
      if (maxId.max_id > 0) {
        await db.query(`SELECT setval('digital_downloads_id_seq', ${maxId.max_id}, true);`);
        console.log("   ✅ Sequence updated\n");
      }

      const [maxPurchaseId] = await db.query(
        `SELECT COALESCE(MAX(id), 0) as max_id FROM digital_download_purchases`,
        { type: QueryTypes.SELECT }
      );
      if (maxPurchaseId.max_id > 0) {
        await db.query(`SELECT setval('digital_download_purchases_id_seq', ${maxPurchaseId.max_id}, true);`);
        console.log("   ✅ Purchase sequence updated\n");
      }
    }

    console.log("==================================================");
    console.log("✅ MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================");
    console.log("\n📝 Summary:");
    console.log("   ✅ Created 'digital_downloads' table with new fields");
    console.log("   ✅ Migrated all ebook data (product_type = 'ebook')");
    console.log("   ✅ Created 'digital_download_purchases' table");
    console.log("   ✅ Migrated all purchase data");
    console.log("\n⚠️  Note:");
    console.log("   - Old 'ebooks' and 'ebook_purchases' tables are kept for rollback");
    console.log("   - You can remove them after verifying the migration");
    console.log("   - Update all models and controllers to use new table names");
    console.log("\n💡 Next steps:");
    console.log("   1. Update models: EBooks → DigitalDownloads");
    console.log("   2. Update controllers to use new model names");
    console.log("   3. Update routes: /ebooks → /digital-downloads");
    console.log("   4. Test all endpoints");
    console.log("   5. Remove old tables after verification\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    if (error.original) {
      console.error("   Original error:", error.original.message);
    }
    console.error("\nFull error:", error);
    process.exit(1);
  }
}

migrateEbooksToDigitalDownloads();

