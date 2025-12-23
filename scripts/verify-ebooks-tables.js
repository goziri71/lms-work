import { db } from "../src/database/database.js";

/**
 * Verify ebooks and ebook_purchases table structure
 * This script checks if the tables exist and have the correct structure
 */
async function verifyEBooksTables() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.\n");

    // Check ebooks table
    console.log("📋 Checking 'ebooks' table...");
    const [ebooksColumns] = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ebooks'
      ORDER BY ordinal_position;
    `);

    if (ebooksColumns.length === 0) {
      console.log("❌ Table 'ebooks' does not exist!");
    } else {
      console.log(`✅ Table 'ebooks' exists with ${ebooksColumns.length} columns:`);
      ebooksColumns.forEach((col) => {
        console.log(`   - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' (NOT NULL)' : ''}`);
      });
    }

    // Check ebook_purchases table
    console.log("\n📋 Checking 'ebook_purchases' table...");
    const [purchasesColumns] = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ebook_purchases'
      ORDER BY ordinal_position;
    `);

    if (purchasesColumns.length === 0) {
      console.log("❌ Table 'ebook_purchases' does not exist!");
    } else {
      console.log(`✅ Table 'ebook_purchases' exists with ${purchasesColumns.length} columns:`);
      purchasesColumns.forEach((col) => {
        console.log(`   - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' (NOT NULL)' : ''}`);
      });
    }

    // Check foreign key constraints
    console.log("\n📋 Checking foreign key constraints...");
    const [foreignKeys] = await db.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      LEFT JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('ebooks', 'ebook_purchases')
      ORDER BY tc.table_name, tc.constraint_name;
    `);

    if (foreignKeys.length === 0) {
      console.log("⚠️  No foreign key constraints found!");
    } else {
      console.log(`✅ Found ${foreignKeys.length} foreign key constraint(s):`);
      foreignKeys.forEach((fk) => {
        console.log(`   - ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (ON DELETE ${fk.delete_rule})`);
      });
    }

    // Check indexes
    console.log("\n📋 Checking indexes...");
    const [indexes] = await db.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('ebooks', 'ebook_purchases')
      ORDER BY tablename, indexname;
    `);

    if (indexes.length === 0) {
      console.log("⚠️  No indexes found!");
    } else {
      console.log(`✅ Found ${indexes.length} index(es):`);
      indexes.forEach((idx) => {
        console.log(`   - ${idx.tablename}.${idx.indexname}`);
      });
    }

    console.log("\n✅ Verification completed.");
  } catch (error) {
    console.error("❌ Verification failed:", error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run verification
verifyEBooksTables();

