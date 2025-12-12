import { Op } from "sequelize";
import { Students } from "../models/auth/student.js";
import { Courses } from "../models/course/courses.js";
import { CourseReg } from "../models/course_reg.js";
import { Semester } from "../models/auth/semester.js";

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

  // Convert academic year to string (database stores as VARCHAR)
  const academicYearStr = academicYear?.toString();

  // Validate semester format
  const semesterStr = semester?.toString().toUpperCase();
  if (semesterStr !== "1ST" && semesterStr !== "2ND") {
    throw new Error(`Invalid semester format. Must be "1ST" or "2ND", got: ${semester}`);
  }

  // Get all active WPU students
  const students = await Students.findAll({
    where: {
      admin_status: "active", // Only active students
    },
    attributes: ["id", "program_id", "facaulty_id", "level"],
  });

  if (students.length === 0) {
    return {
      ...results,
      message: "No active students found",
    };
  }

  const allocationDate = new Date();
  const today = allocationDate.toISOString().split("T")[0];

  // Process each student
  for (const student of students) {
    // Skip if student doesn't have required fields
    if (!student.program_id || !student.level) {
      results.skipped++;
      continue;
    }

    // Convert student level to integer for comparison
    const studentLevel = parseInt(student.level, 10);
    if (isNaN(studentLevel)) {
      results.skipped++;
      continue;
    }

    // Find matching courses for this student
    const courseWhere = {
      // Match program
      program_id: student.program_id,
      // Match level (course_level is INTEGER, student.level is STRING converted to INT)
      course_level: studentLevel,
      // Match semester
      semester: semesterStr,
      // Only WPU courses
      owner_type: { [Op.in]: ["wpu", "wsp"] },
      // Exclude marketplace courses
      is_marketplace: false,
    };

    const matchingCourses = await Courses.findAll({
      where: courseWhere,
      attributes: ["id", "price", "title", "course_code"],
    });

    if (matchingCourses.length === 0) {
      // No matching courses for this student - not an error, just skip
      continue;
    }

    // Allocate each matching course
    for (const course of matchingCourses) {
      try {
        // Check if already allocated/registered/cancelled
        const existing = await CourseReg.findOne({
          where: {
            student_id: student.id,
            course_id: course.id,
            academic_year: academicYearStr,
            semester: semesterStr,
          },
        });

        if (existing) {
          // Already exists - skip
          results.skipped++;
          continue;
        }

        // Get course price (convert STRING to DECIMAL)
        const coursePrice = parseFloat(course.price) || 0;

        // Create allocation
        await CourseReg.create({
          student_id: student.id,
          course_id: course.id,
          academic_year: academicYearStr,
          semester: semesterStr,
          program_id: student.program_id,
          facaulty_id: student.facaulty_id,
          level: student.level,
          registration_status: "allocated",
          allocated_price: coursePrice,
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

