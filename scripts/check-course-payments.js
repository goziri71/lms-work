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

async function checkCoursePayments() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    const academicYear = "2026/2027";
    const semester = "1ST";

    console.log(`Checking payment records for: ${academicYear} - ${semester} Semester\n`);
    console.log("=" .repeat(60));

    // 1. Check CourseOrder records
    console.log("\n1️⃣ Checking CourseOrder records...");
    const courseOrders = await db.query(
      `SELECT COUNT(*) as count, 
              SUM(CAST(amount AS DECIMAL)) as total_amount
       FROM course_order 
       WHERE academic_year = :academicYear 
       AND semester = :semester`,
      {
        replacements: { academicYear, semester },
        type: Sequelize.QueryTypes.SELECT,
      }
    );
    console.log(`   Found ${courseOrders[0].count} CourseOrder records`);
    console.log(`   Total amount: ${courseOrders[0].total_amount || 0}`);

    // Get sample CourseOrder records
    const sampleOrders = await db.query(
      `SELECT id, student_id, amount, currency, date, academic_year, semester
       FROM course_order 
       WHERE academic_year = :academicYear 
       AND semester = :semester
       ORDER BY id DESC
       LIMIT 5`,
      {
        replacements: { academicYear, semester },
        type: Sequelize.QueryTypes.SELECT,
      }
    );
    if (sampleOrders.length > 0) {
      console.log(`   Sample records:`);
      sampleOrders.forEach((order) => {
        console.log(`   - Order ID: ${order.id}, Student: ${order.student_id}, Amount: ${order.amount} ${order.currency}`);
      });
    }

    // 2. Check CourseReg records with registered status
    console.log("\n2️⃣ Checking CourseReg records with 'registered' status...");
    const registeredCourses = await db.query(
      `SELECT COUNT(*) as count
       FROM course_reg 
       WHERE academic_year = :academicYear 
       AND semester = :semester
       AND registration_status = 'registered'
       AND course_reg_id IS NOT NULL`,
      {
        replacements: { academicYear, semester },
        type: Sequelize.QueryTypes.SELECT,
      }
    );
    console.log(`   Found ${registeredCourses[0].count} registered courses with payment`);

    // Get breakdown by status
    const statusBreakdown = await db.query(
      `SELECT registration_status, 
              COUNT(*) as count,
              COUNT(CASE WHEN course_reg_id IS NOT NULL THEN 1 END) as with_payment_id
       FROM course_reg 
       WHERE academic_year = :academicYear 
       AND semester = :semester
       GROUP BY registration_status`,
      {
        replacements: { academicYear, semester },
        type: Sequelize.QueryTypes.SELECT,
      }
    );
    console.log(`   Status breakdown:`);
    statusBreakdown.forEach((status) => {
      console.log(`   - ${status.registration_status}: ${status.count} (${status.with_payment_id} with course_reg_id)`);
    });

    // 3. Check Funding records for course registration
    console.log("\n3️⃣ Checking Funding records (Course Registration debits)...");
    const fundingDebits = await db.query(
      `SELECT COUNT(*) as count,
              SUM(CAST(amount AS DECIMAL)) as total_debited
       FROM funding 
       WHERE academic_year = :academicYear 
       AND semester = :semester
       AND type = 'Debit'
       AND service_name = 'Course Registration'`,
      {
        replacements: { academicYear, semester },
        type: Sequelize.QueryTypes.SELECT,
      }
    );
    console.log(`   Found ${fundingDebits[0].count} Course Registration debit transactions`);
    console.log(`   Total debited: ${fundingDebits[0].total_debited || 0}`);

    // 4. Check total allocated courses
    console.log("\n4️⃣ Checking total allocated courses...");
    const totalAllocated = await db.query(
      `SELECT COUNT(*) as count
       FROM course_reg 
       WHERE academic_year = :academicYear 
       AND semester = :semester
       AND registration_status = 'allocated'`,
      {
        replacements: { academicYear, semester },
        type: Sequelize.QueryTypes.SELECT,
      }
    );
    console.log(`   Found ${totalAllocated[0].count} allocated (unpaid) courses`);

    // 5. Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY:");
    console.log("=".repeat(60));
    console.log(`Academic Year: ${academicYear}`);
    console.log(`Semester: ${semester}`);
    console.log(`\nCourse Orders: ${courseOrders[0].count}`);
    console.log(`Registered Courses (with payment): ${registeredCourses[0].count}`);
    console.log(`Funding Debits: ${fundingDebits[0].count}`);
    console.log(`Allocated (unpaid) Courses: ${totalAllocated[0].count}`);

    if (courseOrders[0].count === 0 && registeredCourses[0].count === 0 && fundingDebits[0].count === 0) {
      console.log("\n⚠️  NO PAYMENT RECORDS FOUND");
      console.log("   All courses should show paid: false");
    } else {
      console.log("\n✅ PAYMENT RECORDS FOUND");
      console.log("   Some students have paid for courses");
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

checkCoursePayments();

