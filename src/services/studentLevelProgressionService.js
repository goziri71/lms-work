import { CourseReg } from "../models/course_reg.js";
import { Students } from "../models/auth/student.js";
import { Op } from "sequelize";

/**
 * Check and progress student level if eligible
 * This is called during course registration to check if student should move to next level
 * 
 * @param {number} studentId - Student ID
 * @param {string} currentAcademicYear - Current academic year (e.g., "2026/2027")
 * @returns {Promise<{progressed: boolean, previousLevel: string|null, newLevel: string|null, reason: string}>}
 */
export async function checkAndProgressStudentLevel(studentId, currentAcademicYear) {
  try {
    // Get student with current level
    const student = await Students.findByPk(studentId, {
      attributes: ["id", "level"],
    });

    if (!student || !student.level) {
      return {
        progressed: false,
        previousLevel: student?.level || null,
        newLevel: student?.level || null,
        reason: "Student not found or has no level",
      };
    }

    const currentLevel = parseInt(student.level, 10);
    
    // Skip if level is not a valid number
    if (isNaN(currentLevel)) {
      return {
        progressed: false,
        previousLevel: student.level,
        newLevel: student.level,
        reason: "Invalid level format",
      };
    }

    // Find student's most recent registration to get previous academic year
    const lastRegistration = await CourseReg.findOne({
      where: {
        student_id: studentId,
        academic_year: { [Op.ne]: null }, // Exclude marketplace purchases
        semester: { [Op.ne]: null },
      },
      order: [["id", "DESC"]],
      attributes: ["academic_year", "semester"],
    });

    // If no previous registration, this is first time - no progression needed
    if (!lastRegistration) {
      return {
        progressed: false,
        previousLevel: student.level,
        newLevel: student.level,
        reason: "First time registration - no previous academic year",
      };
    }

    const previousAcademicYear = lastRegistration.academic_year?.toString();
    const currentAcademicYearStr = currentAcademicYear?.toString();

    // Check if this is a new academic year
    if (previousAcademicYear === currentAcademicYearStr) {
      return {
        progressed: false,
        previousLevel: student.level,
        newLevel: student.level,
        reason: "Same academic year - no progression needed",
      };
    }

    // New academic year detected - check if student has both semesters from previous year
    const firstSemesterReg = await CourseReg.findOne({
      where: {
        student_id: studentId,
        academic_year: previousAcademicYear,
        semester: "1ST",
      },
      attributes: ["id"],
    });

    const secondSemesterReg = await CourseReg.findOne({
      where: {
        student_id: studentId,
        academic_year: previousAcademicYear,
        semester: "2ND",
      },
      attributes: ["id"],
    });

    // Only progress if student has registrations for BOTH semesters
    if (!firstSemesterReg) {
      return {
        progressed: false,
        previousLevel: student.level,
        newLevel: student.level,
        reason: `Missing 1ST semester registration for ${previousAcademicYear}`,
      };
    }

    if (!secondSemesterReg) {
      return {
        progressed: false,
        previousLevel: student.level,
        newLevel: student.level,
        reason: `Missing 2ND semester registration for ${previousAcademicYear}`,
      };
    }

    // Student has both semesters - progress to next level
    const newLevel = (currentLevel + 1).toString();
    
    await student.update({ level: newLevel });

    return {
      progressed: true,
      previousLevel: student.level,
      newLevel: newLevel,
      reason: `Progressed from level ${student.level} to ${newLevel} - completed both semesters of ${previousAcademicYear}`,
    };
  } catch (error) {
    console.error(`Error checking/progressing student level for student ${studentId}:`, error);
    return {
      progressed: false,
      previousLevel: null,
      newLevel: null,
      reason: `Error: ${error.message}`,
    };
  }
}

