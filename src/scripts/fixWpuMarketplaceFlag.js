import { db } from "../database/database.js";

/**
 * Fix WPU courses that might have is_marketplace = true
 * WPU courses should NEVER have is_marketplace = true
 */
async function fixWpuMarketplaceFlag() {
  try {
    // Connect only to PostgreSQL (not MongoDB)
    console.log("🔌 Connecting to database...");
    await db.authenticate();
    console.log("✅ Database connected\n");
    
    console.log("🔧 Fixing WPU courses marketplace flag...\n");

    // Check current state
    const [before] = await db.query(`
      SELECT COUNT(*) as count
      FROM courses
      WHERE owner_type = 'wpu' AND is_marketplace = true
    `);
    const beforeCount = before[0].count;

    if (beforeCount === 0) {
      console.log("✅ No WPU courses with is_marketplace = true found.");
      console.log("   All WPU courses are correctly configured.\n");
      await db.sequelize.close();
      return;
    }

    console.log(`⚠️  Found ${beforeCount} WPU courses with is_marketplace = true`);
    console.log("   Fixing...\n");

    // Fix: Set is_marketplace = false for all WPU courses
    const [result] = await db.query(`
      UPDATE courses
      SET is_marketplace = false,
          marketplace_status = NULL
      WHERE owner_type = 'wpu' AND is_marketplace = true
    `);

    console.log(`✅ Fixed ${result.rowCount} WPU courses`);
    console.log("   - Set is_marketplace = false");
    console.log("   - Set marketplace_status = NULL\n");

    // Verify
    const [after] = await db.query(`
      SELECT COUNT(*) as count
      FROM courses
      WHERE owner_type = 'wpu' AND is_marketplace = true
    `);
    const afterCount = after[0].count;

    if (afterCount === 0) {
      console.log("✅ Verification passed: All WPU courses now have is_marketplace = false");
    } else {
      console.log(`❌ Warning: ${afterCount} WPU courses still have is_marketplace = true`);
    }

    await db.sequelize.close();
    console.log("\n✅ Done!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

fixWpuMarketplaceFlag();

