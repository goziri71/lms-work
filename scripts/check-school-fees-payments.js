import dotenv from "dotenv";
import { Sequelize, Op } from "sequelize";
import { Config } from "../src/config/config.js";
import { SchoolFees } from "../src/models/payment/schoolFees.js";
import { Students } from "../src/models/auth/student.js";
import { setupAssociations } from "../src/models/associations.js";

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

// Setup associations
setupAssociations();

async function checkSchoolFeesPayments() {
  try {
    await db.authenticate();
    console.log("✅ Database connected\n");

    console.log("=".repeat(60));
    console.log("SCHOOL FEES PAYMENT CHECK");
    console.log("=".repeat(60) + "\n");

    // Get total count of school fees records
    const totalRecords = await SchoolFees.count();
    console.log(`📊 Total School Fees Records: ${totalRecords}\n`);

    // Get count by status
    const byStatus = await SchoolFees.findAll({
      attributes: [
        "status",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
        [Sequelize.fn("SUM", Sequelize.col("amount")), "total_amount"],
      ],
      group: ["status"],
      raw: true,
    });

    console.log("📈 Payment Status Breakdown:");
    console.log("--------------------------------------------------------------------------------");
    byStatus.forEach((item) => {
      const status = item.status || "NULL";
      const count = parseInt(item.count) || 0;
      const total = parseFloat(item.total_amount) || 0;
      console.log(`  ${status.padEnd(15)} - ${count.toString().padStart(5)} records - Total: ${total.toLocaleString()} NGN`);
    });
    console.log();

    // Get paid school fees
    const paidFees = await SchoolFees.findAll({
      where: {
        status: "Paid",
      },
      include: [
        {
          model: Students,
          as: "student",
          attributes: ["id", "fname", "lname", "email", "matric_number"],
          required: false,
        },
      ],
      order: [["date", "DESC"]],
      limit: 10, // Show first 10
    });

    console.log(`✅ Students Who Have Paid School Fees: ${paidFees.length} (showing first 10)\n`);
    console.log("--------------------------------------------------------------------------------");
    
    if (paidFees.length === 0) {
      console.log("  ❌ No students have paid school fees yet.\n");
    } else {
      paidFees.forEach((fee, index) => {
        const student = fee.student;
        const studentName = student
          ? `${student.fname} ${student.lname}`.trim()
          : `Student ID: ${fee.student_id}`;
        const matric = student?.matric_number || "N/A";
        console.log(`  ${index + 1}. ${studentName}`);
        console.log(`     Matric: ${matric}`);
        console.log(`     Amount: ${fee.amount} ${fee.currency || "NGN"}`);
        console.log(`     Academic Year: ${fee.academic_year || "N/A"}`);
        console.log(`     Semester: ${fee.semester || "N/A"}`);
        console.log(`     Date: ${fee.date || "N/A"}`);
        console.log(`     Reference: ${fee.teller_no || "N/A"}`);
        console.log();
      });
    }

    // Get unique students who have paid
    const uniquePaidStudents = await SchoolFees.findAll({
      where: {
        status: "Paid",
      },
      attributes: [
        [Sequelize.fn("COUNT", Sequelize.fn("DISTINCT", Sequelize.col("student_id"))), "unique_students"],
      ],
      raw: true,
    });

    const uniqueCount = parseInt(uniquePaidStudents[0]?.unique_students || 0);
    console.log(`👥 Unique Students Who Have Paid: ${uniqueCount}\n`);

    // Get breakdown by academic year and semester
    const byAcademicYearSemester = await SchoolFees.findAll({
      where: {
        status: "Paid",
      },
      attributes: [
        "academic_year",
        "semester",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
        [Sequelize.fn("SUM", Sequelize.col("amount")), "total_amount"],
      ],
      group: ["academic_year", "semester"],
      order: [["academic_year", "DESC"], ["semester", "ASC"]],
      raw: true,
    });

    if (byAcademicYearSemester.length > 0) {
      console.log("📅 Payments by Academic Year and Semester:");
      console.log("--------------------------------------------------------------------------------");
      byAcademicYearSemester.forEach((item) => {
        const year = item.academic_year || "N/A";
        const sem = item.semester || "N/A";
        const count = parseInt(item.count) || 0;
        const total = parseFloat(item.total_amount) || 0;
        console.log(`  ${year.padEnd(15)} ${sem.padEnd(5)} - ${count.toString().padStart(5)} payments - Total: ${total.toLocaleString()} NGN`);
      });
      console.log();
    }

    // Get total active students
    const totalActiveStudents = await Students.count({
      where: {
        admin_status: "active",
      },
    });

    console.log(`📚 Total Active Students: ${totalActiveStudents}`);
    console.log(`💰 Students Who Have Paid: ${uniqueCount}`);
    console.log(`📉 Students Who Haven't Paid: ${totalActiveStudents - uniqueCount}`);
    console.log(`📊 Payment Rate: ${totalActiveStudents > 0 ? ((uniqueCount / totalActiveStudents) * 100).toFixed(2) : 0}%\n`);

    console.log("=".repeat(60));
    console.log("Check complete!");
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("❌ Error checking school fees payments:", error);
  } finally {
    await db.close();
  }
}

checkSchoolFeesPayments();

