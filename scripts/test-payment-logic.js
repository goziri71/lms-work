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

async function testPaymentLogic() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    const academicYear = "2026/2027";
    const semester = "1ST";

    console.log(`Testing payment logic for: ${academicYear} - ${semester} Semester\n`);
    console.log("=".repeat(80));

    // Get sample course registrations
    const courseRegs = await db.query(
      `SELECT 
        cr.id,
        cr.student_id,
        cr.course_id,
        cr.registration_status,
        cr.course_reg_id,
        c.title,
        c.course_code,
        c.owner_type,
        c.is_marketplace,
        c.marketplace_status,
        c.price,
        c.currency
       FROM course_reg cr
       INNER JOIN courses c ON cr.course_id = c.id
       WHERE cr.academic_year = :academicYear 
       AND cr.semester = :semester
       ORDER BY c.course_code
       LIMIT 5`,
      {
        replacements: { academicYear, semester },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`\nTesting ${courseRegs.length} course registrations:\n`);

    courseRegs.forEach((reg) => {
      const coursePrice = parseFloat(reg.price) || 0;
      const isMarketplace = reg.is_marketplace === true && reg.marketplace_status === "published";
      const isRegistered = reg.registration_status === "registered" && reg.course_reg_id !== null;

      console.log(`Course: ${reg.course_code} - ${reg.title}`);
      console.log(`  Owner: ${reg.owner_type}`);
      console.log(`  Marketplace: ${reg.is_marketplace}, Status: ${reg.marketplace_status || "NULL"}`);
      console.log(`  Price: ${coursePrice} ${reg.currency || "NGN"}`);
      console.log(`  Registration Status: ${reg.registration_status}`);
      console.log(`  course_reg_id: ${reg.course_reg_id || "NULL"}`);

      // Apply new payment logic
      let paid = false;
      let reason = "";

      if (isMarketplace) {
        if (coursePrice === 0) {
          paid = true;
          reason = "Marketplace course - free promo (price = 0)";
        } else {
          paid = true;
          reason = "Marketplace course - payment done during purchase";
        }
      } else if (isRegistered) {
        paid = true;
        reason = "Course registration payment completed";
      } else {
        paid = false;
        reason = "Course registration payment not completed";
      }

      console.log(`  ✅ Should show paid: ${paid}`);
      console.log(`  📝 Reason: ${reason}`);
      console.log("");
    });

    console.log("=".repeat(80));
    console.log("📊 EXPECTED RESULTS:");
    console.log("=".repeat(80));
    console.log("All 23 courses should show paid: false");
    console.log("Because:");
    console.log("  - They are NOT marketplace courses");
    console.log("  - registration_status = 'allocated' (not 'registered')");
    console.log("  - course_reg_id = NULL");
    console.log("\nOnce students register and pay, they will show paid: true");

    await db.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.original) {
      console.error("   Original error:", error.original.message);
    }
    process.exit(1);
  }
}

testPaymentLogic();

