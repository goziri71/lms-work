import { Op } from "sequelize";
import { SchoolFees } from "../models/payment/schoolFees.js";
import { CourseReg } from "../models/course_reg.js";
import { Courses } from "../models/course/courses.js";
import { Semester } from "../models/auth/semester.js";

/**
 * Check if student has paid school fees for the given academic year and semester
 * School fees must be paid every semester
 * @param {number} studentId - Student ID
 * @param {string} academicYear - Academic year (e.g., "2024/2025")
 * @param {string} semester - Semester (e.g., "1ST", "2ND")
 * @returns {Promise<boolean>} - True if school fees are paid for this semester
 */
export async function checkSchoolFeesPayment(
  studentId,
  academicYear,
  semester = null
) {
  const where = {
    student_id: studentId,
    academic_year: academicYear,
    status: "Paid",
  };

  // If semester is provided, check for that specific semester
  // If semester is null, check if any payment exists for the academic year (backward compatibility)
  if (semester) {
    where.semester = semester;
  }

  const payment = await SchoolFees.findOne({
    where,
  });

  return !!payment;
}

/**
 * Check if student has paid course fees for a specific course
 * Handles both regular courses (CourseOrder payment) and marketplace courses (enrollment = payment)
 *
 * Business Rules:
 * 1. WPU courses are NOT free by default - students must pay for course registration
 * 2. Marketplace courses: enrollment = payment (unless price = 0 for promo/marketing)
 * 3. Regular WPU courses: require course registration payment (registration_status = "registered" AND course_reg_id IS NOT NULL)
 *
 * @param {number} studentId - Student ID
 * @param {number} courseId - Course ID
 * @param {string} academicYear - Academic year
 * @param {string} semester - Semester
 * @returns {Promise<{paid: boolean, reason?: string}>} - Payment status
 */
export async function checkCourseFeesPayment(
  studentId,
  courseId,
  academicYear,
  semester
) {
  // Get course to determine if it's marketplace or regular
  const course = await Courses.findByPk(courseId);
  if (!course) {
    return { paid: false, reason: "Course not found" };
  }

  // Check if it's a marketplace course (any owner type - including WPU marketplace)
  const isMarketplace =
    course.is_marketplace === true && course.marketplace_status === "published";

  // For marketplace courses: check for lifetime access enrollment (academic_year and semester are NULL)
  if (isMarketplace) {
    const marketplaceEnrollment = await CourseReg.findOne({
      where: {
        student_id: studentId,
        course_id: courseId,
        registration_status: "marketplace_purchased",
        academic_year: null, // Lifetime access - not tied to semester
        semester: null, // Lifetime access - not tied to semester
      },
    });

    if (!marketplaceEnrollment) {
      return { paid: false, reason: "Not enrolled in this marketplace course" };
    }

    const coursePrice = parseFloat(course.price) || 0;

    // If price is 0, it's a free promo/marketing course
    if (coursePrice === 0) {
      return {
        paid: true,
        reason: "Marketplace course - free promo (price = 0)",
      };
    }

    // Otherwise, enrollment means payment was completed during purchase
    return {
      paid: true,
      reason: "Marketplace course - payment done during purchase",
    };
  }

  // For regular program courses: check enrollment with academic_year and semester
  const enrollment = await CourseReg.findOne({
    where: {
      student_id: studentId,
      course_id: courseId,
      academic_year: academicYear,
      semester: semester,
    },
  });

  if (!enrollment) {
    return { paid: false, reason: "Not enrolled in this course" };
  }

  // For regular WPU courses (not on marketplace): check course registration payment
  // Students must pay for course registration before access
  // Payment is indicated by: registration_status = "registered" AND course_reg_id IS NOT NULL
  if (
    enrollment.registration_status === "registered" &&
    enrollment.course_reg_id !== null
  ) {
    return { paid: true, reason: "Course registration payment completed" };
  }

  // Not paid - student hasn't completed course registration payment
  return {
    paid: false,
    reason: "Course registration payment not completed",
  };
}

/**
 * Get current academic year from active semester
 * @returns {Promise<string|null>} - Academic year string or null
 */
export async function getCurrentAcademicYear() {
  const currentDate = new Date();
  const today = currentDate.toISOString().split("T")[0];

  let currentSemester = await Semester.findOne({
    where: {
      [Op.and]: [
        Semester.sequelize.literal(`DATE(start_date) <= '${today}'`),
        Semester.sequelize.literal(`DATE(end_date) >= '${today}'`),
      ],
    },
    order: [["id", "DESC"]],
  });

  if (!currentSemester) {
    currentSemester = await Semester.findOne({
      where: Semester.sequelize.where(
        Semester.sequelize.fn("UPPER", Semester.sequelize.col("status")),
        "ACTIVE"
      ),
      order: [["id", "DESC"]],
    });
  }

  return currentSemester?.academic_year?.toString() || null;
}

/**
 * Verify all payment requirements for exam access
 * @param {number} studentId - Student ID
 * @param {number} courseId - Course ID
 * @param {string} academicYear - Academic year
 * @param {string} semester - Semester
 * @param {boolean} adminOverride - Whether admin is overriding payment checks
 * @returns {Promise<{allowed: boolean, errors: string[]}>} - Access status
 */
export async function verifyExamPaymentRequirements(
  studentId,
  courseId,
  academicYear,
  semester,
  adminOverride = false
) {
  const errors = [];

  // Admin override: skip all checks
  if (adminOverride) {
    return { allowed: true, errors: [] };
  }

  // Check school fees payment (must be paid for this specific semester)
  const schoolFeesPaid = await checkSchoolFeesPayment(
    studentId,
    academicYear,
    semester
  );
  if (!schoolFeesPaid) {
    errors.push(
      `You cannot take this exam. Please pay your school fees for ${academicYear} ${semester} first.`
    );
  }

  // Check course fees payment
  const coursePayment = await checkCourseFeesPayment(
    studentId,
    courseId,
    academicYear,
    semester
  );
  if (!coursePayment.paid) {
    if (coursePayment.reason === "Not enrolled in this course") {
      errors.push("You are not enrolled in this course.");
    } else {
      errors.push(
        "You cannot take this exam. Please complete course registration payment first."
      );
    }
  }

  return {
    allowed: errors.length === 0,
    errors,
  };
}
