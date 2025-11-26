import { db } from "../database/database.js";
import { connectDB } from "../database/database.js";

/**
 * Script to update courses owner_type from "wsp" to "wpu"
 * Also adds "wpu" to the ENUM if it doesn't exist
 */

async function updateCoursesOwnerType() {
  try {
    console.log("🚀 Starting owner_type update...\n");

    // Step 1: Check current ENUM values
    console.log("📊 Checking current ENUM values...");
    const [enumValues] = await db.query(`
      SELECT unnest(enum_range(NULL::enum_courses_owner_type)) as value
    `);
    const currentValues = enumValues.map((r) => r.value);
    console.log(`   Current ENUM values: ${currentValues.join(", ")}\n`);

    // Step 2: Add "wpu" to ENUM if it doesn't exist
    if (!currentValues.includes("wpu")) {
      console.log("➕ Adding 'wpu' to ENUM...");
      try {
        await db.query(`ALTER TYPE enum_courses_owner_type ADD VALUE IF NOT EXISTS 'wpu'`);
        console.log("   ✅ 'wpu' added to ENUM\n");
      } catch (error) {
        // IF NOT EXISTS might not be supported, try without it
        try {
          await db.query(`ALTER TYPE enum_courses_owner_type ADD VALUE 'wpu'`);
          console.log("   ✅ 'wpu' added to ENUM\n");
        } catch (e) {
          if (e.message.includes("already exists")) {
            console.log("   ℹ️  'wpu' already exists in ENUM\n");
          } else {
            throw e;
          }
        }
      }
    } else {
      console.log("   ℹ️  'wpu' already exists in ENUM\n");
    }

    // Step 3: Count courses with "wsp"
    console.log("📊 Checking courses with owner_type = 'wsp'...");
    const [wspCount] = await db.query(
      `SELECT COUNT(*) as count FROM courses WHERE owner_type = 'wsp'`
    );
    const count = parseInt(wspCount[0].count, 10);
    console.log(`   Found ${count} courses with owner_type = 'wsp'\n`);

    if (count === 0) {
      console.log("✅ No courses to update. All courses already use 'wpu'.");
      return;
    }

    // Step 4: Update all courses from "wsp" to "wpu"
    console.log("🔄 Updating courses from 'wsp' to 'wpu'...");
    const [updateResult] = await db.query(`
      UPDATE courses 
      SET owner_type = 'wpu' 
      WHERE owner_type = 'wsp'
    `);
    console.log(`   ✅ Updated ${updateResult.rowCount || count} courses\n`);

    // Step 5: Verify update
    console.log("✅ Verification:");
    const [finalWspCount] = await db.query(
      `SELECT COUNT(*) as count FROM courses WHERE owner_type = 'wsp'`
    );
    const [finalWpuCount] = await db.query(
      `SELECT COUNT(*) as count FROM courses WHERE owner_type = 'wpu'`
    );
    console.log(`   Courses with 'wsp': ${finalWspCount[0].count}`);
    console.log(`   Courses with 'wpu': ${finalWpuCount[0].count}`);

    console.log("\n✅ Update completed successfully!");
  } catch (error) {
    console.error("\n❌ Update failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}

// Run update
connectDB()
  .then(async (success) => {
    if (!success) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    try {
      await updateCoursesOwnerType();
      await db.close();
      console.log("\n🔒 Database connection closed");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ Update failed:", error);
      await db.close();
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  });

