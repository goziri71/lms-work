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

async function checkCoursePricing() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    const academicYear = "2026/2027";
    const semester = "1ST";

    console.log(`Checking course pricing for: ${academicYear} - ${semester} Semester\n`);
    console.log("=".repeat(80));

    // Check course pricing details
    const coursePricing = await db.query(
      `SELECT 
        c.id,
        c.title,
        c.course_code,
        c.owner_type,
        c.is_marketplace,
        c.marketplace_status,
        c.price,
        c.currency,
        cr.registration_status,
        cr.allocated_price
       FROM course_reg cr
       INNER JOIN courses c ON cr.course_id = c.id
       WHERE cr.academic_year = :academicYear 
       AND cr.semester = :semester
       ORDER BY c.course_code`,
      {
        replacements: { academicYear, semester },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`\nFound ${coursePricing.length} course registrations:\n`);

    let freeCount = 0;
    let paidCount = 0;
    let zeroPriceCount = 0;
    let hasPriceCount = 0;

    coursePricing.forEach((course) => {
      const price = parseFloat(course.price) || 0;
      const allocatedPrice = course.allocated_price ? parseFloat(course.allocated_price) : null;
      
      const isMarketplace = course.is_marketplace === true && course.marketplace_status === "published";
      const isFreeWPU = (course.owner_type === "wpu" || course.owner_type === "wsp") && 
                        (!course.is_marketplace || course.marketplace_status !== "published");

      console.log(`Course: ${course.course_code} - ${course.title}`);
      console.log(`  Owner: ${course.owner_type}`);
      console.log(`  Marketplace: ${course.is_marketplace}, Status: ${course.marketplace_status || "NULL"}`);
      console.log(`  Course Price: ${price} ${course.currency || "NGN"}`);
      console.log(`  Allocated Price: ${allocatedPrice !== null ? allocatedPrice : "NULL"}`);
      console.log(`  Registration Status: ${course.registration_status}`);
      
      if (price === 0) {
        zeroPriceCount++;
        console.log(`  ⚠️  PRICE IS ZERO - This is why it's considered "free"`);
      } else {
        hasPriceCount++;
        console.log(`  💰 Has price set: ${price}`);
      }

      if (isFreeWPU) {
        freeCount++;
        console.log(`  ✅ Classified as: Free WPU course (no payment required)`);
      } else if (isMarketplace) {
        console.log(`  ✅ Classified as: Marketplace course`);
      } else {
        paidCount++;
        console.log(`  💳 Classified as: Regular paid course`);
      }
      console.log("");
    });

    console.log("=".repeat(80));
    console.log("📊 SUMMARY:");
    console.log("=".repeat(80));
    console.log(`Total courses: ${coursePricing.length}`);
    console.log(`Courses with price = 0: ${zeroPriceCount}`);
    console.log(`Courses with price > 0: ${hasPriceCount}`);
    console.log(`Classified as Free WPU: ${freeCount}`);
    console.log(`Classified as Paid: ${paidCount}`);

    if (zeroPriceCount > 0) {
      console.log(`\n⚠️  ISSUE FOUND:`);
      console.log(`   ${zeroPriceCount} courses have price = 0 in the database`);
      console.log(`   The payment logic treats WPU courses as "free" if:`);
      console.log(`   1. owner_type = "wpu" or "wsp"`);
      console.log(`   2. NOT on marketplace (is_marketplace = false)`);
      console.log(`   This is INDEPENDENT of the course.price value!`);
      console.log(`\n   So even if price > 0, WPU courses are still considered "free"`);
      console.log(`   unless they're on the marketplace.`);
    }

    await db.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.original) {
      console.error("   Original error:", error.original.message);
    }
    process.exit(1);
  }
}

checkCoursePricing();

