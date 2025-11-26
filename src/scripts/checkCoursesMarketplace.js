import { db } from "../database/database.js";
import { connectDB } from "../database/database.js";

async function checkCoursesMarketplace() {
  try {
    await connectDB();
    console.log("🔍 Checking courses marketplace status...\n");

    const [result] = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN owner_type = 'wpu' THEN 1 END) as wpu_count,
        COUNT(CASE WHEN is_marketplace = true THEN 1 END) as marketplace_count,
        COUNT(CASE WHEN owner_type = 'wpu' AND is_marketplace = true THEN 1 END) as wpu_marketplace
      FROM courses
    `);

    const stats = result[0];
    console.log("📊 Course Statistics:");
    console.log(`   Total courses: ${stats.total}`);
    console.log(`   WPU courses (owner_type = 'wpu'): ${stats.wpu_count}`);
    console.log(`   Marketplace courses (is_marketplace = true): ${stats.marketplace_count}`);
    console.log(`   ⚠️  WPU courses with is_marketplace = true: ${stats.wpu_marketplace}\n`);

    if (stats.wpu_marketplace > 0) {
      console.log("❌ PROBLEM FOUND: WPU courses are marked as marketplace!");
      console.log("   This should be fixed.\n");
      
      // Show sample of problematic courses
      const [samples] = await db.query(`
        SELECT id, title, course_code, owner_type, is_marketplace, marketplace_status
        FROM courses
        WHERE owner_type = 'wpu' AND is_marketplace = true
        LIMIT 5
      `);
      
      console.log("   Sample courses with issue:");
      samples.forEach(c => {
        console.log(`   - ID ${c.id}: ${c.title} (${c.course_code})`);
      });
    } else {
      console.log("✅ All WPU courses correctly have is_marketplace = false");
    }

    await db.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkCoursesMarketplace();

