import { Op } from "sequelize";
import { Students } from "../models/auth/student.js";
import { Courses } from "../models/course/courses.js";
import { CourseReg } from "../models/course_reg.js";
import { Semester } from "../models/auth/semester.js";
import { CourseSemesterPricing } from "../models/course/courseSemesterPricing.js";
import { GeneralSetup } from "../models/settings/generalSetup.js";

function assertSemesterStr(semester) {
  const semesterStr = semester?.toString().toUpperCase();
  if (semesterStr !== "1ST" && semesterStr !== "2ND") {
    throw new Error(
      `Invalid semester format. Must be "1ST" or "2ND", got: ${semester}`
    );
  }
  return semesterStr;
}

/**
 * Auto-allocation for one student row (WPU courses matching program, level, semester).
 * @param {import("sequelize").Model} student - must include id, program_id, facaulty_id, level, currency
 */
async function allocateMatchingWpuCoursesForStudent(
  student,
  academicYearStr,
  semesterStr,
  exchangeRate,
  allocationDate,
  today
) {
  const results = { allocated: 0, skipped: 0, errors: [] };

  if (!student.program_id || !student.level) {
    results.skipped++;
    return results;
  }

  const studentLevel = parseInt(student.level, 10);
  if (isNaN(studentLevel)) {
    results.skipped++;
    return results;
  }

  const courseWhere = {
    program_id: student.program_id,
    course_level: studentLevel,
    semester: semesterStr,
    owner_type: { [Op.in]: ["wpu", "wsp"] },
    is_marketplace: false,
  };

  const matchingCourses = await Courses.findAll({
    where: courseWhere,
    attributes: ["id", "price", "title", "course_code", "currency"],
  });

  if (matchingCourses.length === 0) {
    return results;
  }

  for (const course of matchingCourses) {
    try {
      const existing = await CourseReg.findOne({
        where: {
          student_id: student.id,
          course_id: course.id,
          academic_year: academicYearStr,
          semester: semesterStr,
        },
      });

      if (existing) {
        results.skipped++;
        continue;
      }

      let coursePrice = 0;
      let courseCurrency = "NGN";

      const semesterPricing = await CourseSemesterPricing.findOne({
        where: {
          course_id: course.id,
          academic_year: academicYearStr,
          semester: semesterStr,
        },
      });

      if (semesterPricing) {
        coursePrice = parseFloat(semesterPricing.price) || 0;
        courseCurrency = semesterPricing.currency || course.currency || "NGN";
      } else {
        coursePrice = parseFloat(course.price) || 0;
        courseCurrency = course.currency || "NGN";
      }

      const studentCurrency = student.currency || "NGN";
      let finalPrice = coursePrice;
      if (courseCurrency.toUpperCase() !== studentCurrency.toUpperCase()) {
        if (
          courseCurrency.toUpperCase() === "USD" &&
          studentCurrency.toUpperCase() === "NGN"
        ) {
          finalPrice = coursePrice * exchangeRate;
        } else if (
          courseCurrency.toUpperCase() === "NGN" &&
          studentCurrency.toUpperCase() === "USD"
        ) {
          finalPrice = coursePrice / exchangeRate;
        }
        finalPrice = Math.round(finalPrice * 100) / 100;
      }

      await CourseReg.create({
        student_id: student.id,
        course_id: course.id,
        academic_year: academicYearStr,
        semester: semesterStr,
        program_id: student.program_id,
        facaulty_id: student.facaulty_id,
        level: student.level,
        registration_status: "allocated",
        allocated_price: finalPrice,
        allocated_at: allocationDate,
        first_ca: 0,
        second_ca: 0,
        third_ca: 0,
        exam_score: 0,
        date: today,
      });

      results.allocated++;
    } catch (error) {
      results.errors.push({
        student_id: student.id,
        course_id: course.id,
        course_code: course.course_code,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Allocate matching WPU courses for one student (e.g. after school fees payment).
 * Does not require admin_status active — same course-matching rules as bulk auto-allocation.
 */
export async function allocateCoursesForSingleStudent(studentId, academicYear, semester) {
  const academicYearStr = academicYear?.toString();
  const semesterStr = assertSemesterStr(semester);

  const generalSetup = await GeneralSetup.findOne({
    order: [["id", "DESC"]],
  });
  const exchangeRate = parseFloat(generalSetup?.rate || "1500");

  const student = await Students.findByPk(studentId, {
    attributes: ["id", "program_id", "facaulty_id", "level", "currency"],
  });

  if (!student) {
    return { allocated: 0, skipped: 0, errors: [], message: "Student not found" };
  }

  const allocationDate = new Date();
  const today = allocationDate.toISOString().split("T")[0];

  return allocateMatchingWpuCoursesForStudent(
    student,
    academicYearStr,
    semesterStr,
    exchangeRate,
    allocationDate,
    today
  );
}

/**
 * Automatically allocate courses to all active WPU students for a semester
 * Matches courses based on: program_id, course_level (vs student level), and semester
 *
 * @param {number|string} academicYear - Academic year (will be converted to string)
 * @param {string} semester - Semester ("1ST" or "2ND")
 * @returns {Promise<{allocated: number, skipped: number, errors: Array}>}
 */
export async function allocateCoursesToAllStudents(academicYear, semester) {
  const results = {
    allocated: 0,
    skipped: 0,
    errors: [],
  };

  const academicYearStr = academicYear?.toString();
  const semesterStr = assertSemesterStr(semester);

  const generalSetup = await GeneralSetup.findOne({
    order: [["id", "DESC"]],
  });
  const exchangeRate = parseFloat(generalSetup?.rate || "1500");

  const students = await Students.findAll({
    where: {
      admin_status: "active",
    },
    attributes: ["id", "program_id", "facaulty_id", "level", "currency"],
  });

  if (students.length === 0) {
    return {
      ...results,
      message: "No active students found",
    };
  }

  const allocationDate = new Date();
  const today = allocationDate.toISOString().split("T")[0];

  for (const student of students) {
    const part = await allocateMatchingWpuCoursesForStudent(
      student,
      academicYearStr,
      semesterStr,
      exchangeRate,
      allocationDate,
      today
    );
    results.allocated += part.allocated;
    results.skipped += part.skipped;
    results.errors.push(...part.errors);
  }

  return results;
}

/**
 * Get current active semester
 * @returns {Promise<Semester|null>}
 */
export async function getCurrentActiveSemester() {
  const currentDate = new Date();
  const today = currentDate.toISOString().split("T")[0];

  // Try to find semester by date range first
  let currentSemester = await Semester.findOne({
    where: {
      [Op.and]: [
        Semester.sequelize.literal(`DATE(start_date) <= '${today}'`),
        Semester.sequelize.literal(`DATE(end_date) >= '${today}'`),
      ],
    },
    order: [["id", "DESC"]],
  });

  // Fallback to status-based lookup
  if (!currentSemester) {
    currentSemester = await Semester.findOne({
      where: Semester.sequelize.where(
        Semester.sequelize.fn("UPPER", Semester.sequelize.col("status")),
        "ACTIVE"
      ),
      order: [["id", "DESC"]],
    });
  }

  return currentSemester;
}
