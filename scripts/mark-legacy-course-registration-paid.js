/**
 * Finance-approved: mark course registration as paid for a term when fees were
 * settled outside the current LMS (no wallet debit, no new Funding row).
 *
 * Sets: one course_order + all matching course_reg → registered + course_reg_id.
 * Optionally aligns school_fees.student_level with students.level for that term.
 *
 * Usage:
 *   node scripts/mark-legacy-course-registration-paid.js
 *   node scripts/mark-legacy-course-registration-paid.js WPU9301552
 *
 * Env overrides: STUDENT_ID, ACADEMIC_YEAR, SEMESTER, SKIP_SCHOOL_FEES_SNAPSHOT=1
 */
import dotenv from "dotenv";
import { Op, Transaction } from "sequelize";
import { db } from "../src/database/database.js";
import { Students } from "../src/models/auth/student.js";
import { Courses } from "../src/models/course/courses.js";
import { CourseReg } from "../src/models/course_reg.js";
import { CourseOrder } from "../src/models/payment/courseOrder.js";
import { CourseSemesterPricing } from "../src/models/course/courseSemesterPricing.js";
import { SchoolFees } from "../src/models/payment/schoolFees.js";
import { levelStringFromCourse } from "../src/utils/courseCatalogLevel.js";

dotenv.config({ debug: false });

const ACADEMIC_YEAR =
  process.env.ACADEMIC_YEAR || "2026/2027";
const SEMESTER = process.env.SEMESTER || "2ND";
const SKIP_FEE_SNAPSHOT = process.env.SKIP_SCHOOL_FEES_SNAPSHOT === "1";

async function getCoursePriceForSemester(courseId, academicYear, semester) {
  const pricing = await CourseSemesterPricing.findOne({
    where: {
      course_id: courseId,
      academic_year: academicYear.toString(),
      semester: semester.toString(),
    },
  });

  if (pricing) {
    return parseFloat(pricing.price);
  }

  const course = await Courses.findByPk(courseId);
  if (course && course.price) {
    return parseFloat(course.price);
  }

  return 0;
}

async function resolveStudentId() {
  if (process.env.STUDENT_ID) {
    return parseInt(process.env.STUDENT_ID, 10);
  }
  const matric = process.argv[2]?.trim() || "WPU9301552";
  const student = await Students.findOne({
    where: {
      matric_number: { [Op.iLike]: matric },
    },
    attributes: ["id", "matric_number"],
  });
  if (!student) {
    throw new Error(`Student not found for matric: ${matric}`);
  }
  return student.id;
}

async function main() {
  const studentId = await resolveStudentId();

  const result = await db.transaction(async (transaction) => {
    const student = await Students.findByPk(studentId, {
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!student) {
      throw new Error("Student not found");
    }

    const regs = await CourseReg.findAll({
      where: {
        student_id: studentId,
        academic_year: ACADEMIC_YEAR,
        semester: SEMESTER,
        registration_status: "allocated",
      },
      transaction,
    });

    if (regs.length === 0) {
      const already = await CourseReg.count({
        where: {
          student_id: studentId,
          academic_year: ACADEMIC_YEAR,
          semester: SEMESTER,
          registration_status: "registered",
        },
        transaction,
      });
      return {
        skipped: true,
        reason:
          already > 0
            ? "No allocated rows; student may already be registered for this term."
            : "No course_reg rows for this term.",
        student_id: studentId,
      };
    }

    let totalAmount = 0;
    const lines = [];
    for (const reg of regs) {
      const course = await Courses.findByPk(reg.course_id, { transaction });
      const price = await getCoursePriceForSemester(
        reg.course_id,
        ACADEMIC_YEAR,
        SEMESTER,
      );
      totalAmount += price;
      lines.push({
        reg_id: reg.id,
        course_id: reg.course_id,
        course_code: course?.course_code,
        price,
      });
    }

    const currency = (student.currency || "NGN")
      .toString()
      .toUpperCase()
      .substring(0, 5);
    const order = await CourseOrder.create(
      {
        student_id: studentId,
        amount: String(Math.round(totalAmount)),
        currency,
        date: new Date(),
        semester: SEMESTER,
        academic_year: ACADEMIC_YEAR,
        level:
          (student.level && String(student.level).substring(0, 10)) || "700",
      },
      { transaction },
    );

    const registrationDate = new Date();
    for (const reg of regs) {
      const course = await Courses.findByPk(reg.course_id, { transaction });
      const currentPrice = await getCoursePriceForSemester(
        reg.course_id,
        ACADEMIC_YEAR,
        SEMESTER,
      );
      const catalogLevel = levelStringFromCourse(course);
      await reg.update(
        {
          registration_status: "registered",
          course_reg_id: order.id,
          registered_at: registrationDate,
          allocated_price: currentPrice,
          level: catalogLevel ?? reg.level,
        },
        { transaction },
      );
    }

    let schoolFeesUpdated = 0;
    if (!SKIP_FEE_SNAPSHOT && student.level) {
      const snap = String(student.level).substring(0, 11);
      const [n] = await SchoolFees.update(
        { student_level: snap },
        {
          where: {
            student_id: studentId,
            academic_year: ACADEMIC_YEAR,
            semester: SEMESTER,
            status: "Paid",
          },
          transaction,
        },
      );
      schoolFeesUpdated = n;
    }

    return {
      skipped: false,
      student_id: studentId,
      matric_number: student.matric_number,
      course_order_id: order.id,
      amount_recorded: Math.round(totalAmount),
      currency,
      registrations_updated: regs.length,
      lines,
      school_fees_rows_updated: schoolFeesUpdated,
      note: "No wallet debit; no Funding row. Finance: paid off-system.",
    };
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => db.close())
  .catch((e) => {
    console.error(e);
    db.close();
    process.exit(1);
  });
