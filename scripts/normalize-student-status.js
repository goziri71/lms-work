import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { Config } from "../src/config/config.js";

dotenv.config({ debug: false });

const db = new Sequelize(
  Config.database.url || Config.database.name,
  Config.database.username,
  Config.database.password,
  {
    host: Config.database.host,
    dialect: Config.database.dialect,
    logging: false,
    dialectOptions: Config.database.dialectOptions,
    pool: Config.database.pool,
  }
);

async function normalizeStudentStatus() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    console.log("=".repeat(80));
    console.log("NORMALIZING STUDENT admin_status VALUES");
    console.log("=".repeat(80));

    // Step 1: Check current status distribution
    console.log("\n📊 Current Status Distribution:");
    console.log("-".repeat(80));
    const currentStatus = await db.query(
      `SELECT admin_status, COUNT(*) as count 
       FROM students 
       GROUP BY admin_status 
       ORDER BY count DESC`,
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    currentStatus.forEach((status) => {
      console.log(`  "${status.admin_status || "NULL"}" - ${status.count} students`);
    });

    // Step 2: Show what will be changed
    console.log("\n🔄 Normalization Plan:");
    console.log("-".repeat(80));
    console.log('  "Active" → "active"');
    console.log('  "Pending" → "pending"');
    console.log('  "active" → "active" (no change)');
    console.log('  "inactive" → "inactive" (no change)');
    console.log('  NULL → NULL (no change)');

    // Step 3: Get counts before update
    const activeCount = await db.query(
      `SELECT COUNT(*) as count FROM students WHERE LOWER(admin_status) = 'active'`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const pendingCount = await db.query(
      `SELECT COUNT(*) as count FROM students WHERE LOWER(admin_status) = 'pending'`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const inactiveCount = await db.query(
      `SELECT COUNT(*) as count FROM students WHERE LOWER(admin_status) = 'inactive'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log("\n📈 Expected Results After Normalization:");
    console.log("-".repeat(80));
    console.log(`  "active" - ${activeCount[0].count} students`);
    console.log(`  "pending" - ${pendingCount[0].count} students`);
    console.log(`  "inactive" - ${inactiveCount[0].count} students`);

    // Step 4: Perform normalization
    console.log("\n⚙️  Normalizing values...");
    console.log("-".repeat(80));

    // Update "Active" to "active"
    const activeUpdate = await db.query(
      `UPDATE students 
       SET admin_status = 'active' 
       WHERE LOWER(admin_status) = 'active' AND admin_status != 'active'`,
      { type: Sequelize.QueryTypes.UPDATE }
    );
    console.log(`  ✅ Updated "Active" → "active": ${activeUpdate[1]} rows`);

    // Update "Pending" to "pending"
    const pendingUpdate = await db.query(
      `UPDATE students 
       SET admin_status = 'pending' 
       WHERE LOWER(admin_status) = 'pending' AND admin_status != 'pending'`,
      { type: Sequelize.QueryTypes.UPDATE }
    );
    console.log(`  ✅ Updated "Pending" → "pending": ${pendingUpdate[1]} rows`);

    // Update "Inactive" to "inactive" (if exists)
    const inactiveUpdate = await db.query(
      `UPDATE students 
       SET admin_status = 'inactive' 
       WHERE LOWER(admin_status) = 'inactive' AND admin_status != 'inactive'`,
      { type: Sequelize.QueryTypes.UPDATE }
    );
    console.log(`  ✅ Updated "Inactive" → "inactive": ${inactiveUpdate[1]} rows`);

    // Step 5: Verify results
    console.log("\n✅ Verification - Final Status Distribution:");
    console.log("-".repeat(80));
    const finalStatus = await db.query(
      `SELECT admin_status, COUNT(*) as count 
       FROM students 
       GROUP BY admin_status 
       ORDER BY count DESC`,
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    finalStatus.forEach((status) => {
      console.log(`  "${status.admin_status || "NULL"}" - ${status.count} students`);
    });

    // Check for any remaining inconsistencies
    const inconsistent = await db.query(
      `SELECT admin_status, COUNT(*) as count 
       FROM students 
       WHERE admin_status IS NOT NULL 
         AND admin_status NOT IN ('active', 'pending', 'inactive')
       GROUP BY admin_status`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (inconsistent.length > 0) {
      console.log("\n⚠️  Warning: Found unexpected status values:");
      inconsistent.forEach((status) => {
        console.log(`  "${status.admin_status}" - ${status.count} students`);
      });
    } else {
      console.log("\n✅ All status values normalized successfully!");
    }

    console.log("\n" + "=".repeat(80));
    console.log("Normalization complete!");
    console.log("=".repeat(80));

    await db.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.original) {
      console.error("   Original error:", error.original.message);
    }
    process.exit(1);
  }
}

normalizeStudentStatus();

