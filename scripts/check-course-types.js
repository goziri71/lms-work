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

async function checkCourseTypes() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    const academicYear = "2026/2027";
    const semester = "1ST";

    console.log(`Checking course types for: ${academicYear} - ${semester} Semester\n`);
    console.log("=".repeat(60));

    // Check course types for allocated courses
    const courseTypes = await db.query(
      `SELECT 
        c.id,
        c.title,
        c.course_code,
        c.owner_type,
        c.is_marketplace,
        c.marketplace_status,
        c.price,
        cr.registration_status,
        cr.course_reg_id
       FROM course_reg cr
       INNER JOIN courses c ON cr.course_id = c.id
       WHERE cr.academic_year = :academicYear 
       AND cr.semester = :semester
       ORDER BY c.id`,
      {
        replacements: { academicYear, semester },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`\nFound ${courseTypes.length} course registrations:\n`);

    let freeWPUCount = 0;
    let marketplaceCount = 0;
    let regularPaidCount = 0;

    courseTypes.forEach((course) => {
      const isMarketplace = course.is_marketplace === true && course.marketplace_status === "published";
      const isFreeWPU = (course.owner_type === "wpu" || course.owner_type === "wsp") && 
                        (!course.is_marketplace || course.marketplace_status !== "published");
      
      let shouldBePaid = false;
      let reason = "";

      if (isMarketplace) {
        shouldBePaid = true;
        reason = "Marketplace course";
        marketplaceCount++;
      } else if (isFreeWPU) {
        shouldBePaid = true;
        reason = "Free WPU course";
        freeWPUCount++;
      } else {
        shouldBePaid = course.registration_status === "registered" && course.course_reg_id !== null;
        reason = shouldBePaid ? "Paid regular course" : "Unpaid regular course";
        if (shouldBePaid) regularPaidCount++;
      }

      console.log(`Course: ${course.course_code} - ${course.title}`);
      console.log(`  Owner: ${course.owner_type}, Marketplace: ${course.is_marketplace}, Status: ${course.marketplace_status}`);
      console.log(`  Registration Status: ${course.registration_status}, course_reg_id: ${course.course_reg_id || "NULL"}`);
      console.log(`  Should show paid: ${shouldBePaid} (${reason})`);
      console.log("");
    });

    console.log("=".repeat(60));
    console.log("📊 BREAKDOWN:");
    console.log("=".repeat(60));
    console.log(`Total courses: ${courseTypes.length}`);
    console.log(`Free WPU courses (should show paid: true): ${freeWPUCount}`);
    console.log(`Marketplace courses (should show paid: true): ${marketplaceCount}`);
    console.log(`Regular paid courses (should show paid: true): ${regularPaidCount}`);
    console.log(`Regular unpaid courses (should show paid: false): ${courseTypes.length - freeWPUCount - marketplaceCount - regularPaidCount}`);

    await db.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.original) {
      console.error("   Original error:", error.original.message);
    }
    process.exit(1);
  }
}

checkCourseTypes();

