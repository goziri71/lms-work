import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { Semester } from "../../models/auth/semester.js";
import { CourseOrder } from "../../models/payment/courseOrder.js";
import { Funding } from "../../models/payment/funding.js";
import { checkSchoolFeesPayment } from "../../services/paymentVerificationService.js";

/**
 * STUDENT REGISTER FOR COURSE(S)
 * POST /api/courses/register
 * Supports both single course (course_id) and multiple courses (course_ids array)
 */
export const registerCourse = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can register for courses", 403);
  }

  const { course_id, course_ids, academic_year, semester, level } = req.body;

  // Support both single course_id and multiple course_ids
  let coursesToRegister = [];
  if (course_ids && Array.isArray(course_ids) && course_ids.length > 0) {
    coursesToRegister = course_ids;
  } else if (course_id) {
    coursesToRegister = [course_id];
  } else {
    throw new ErrorClass(
      "Either course_id or course_ids array is required",
      400
    );
  }

  // Validate required fields
  if (!academic_year || !semester) {
    throw new ErrorClass("academic_year and semester are required", 400);
  }

  // Verify student exists
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Check if student has paid school fees for this academic year
  // School fees payment is required before course registration
  const schoolFeesPaid = await checkSchoolFeesPayment(studentId, academic_year);
  if (!schoolFeesPaid) {
    throw new ErrorClass(
      "You cannot register for courses. Please pay your school fees for this academic year first.",
      400
    );
  }

  // Get all courses to register
  const courses = await Courses.findAll({
    where: {
      id: coursesToRegister,
    },
  });

  if (courses.length !== coursesToRegister.length) {
    const foundIds = courses.map((c) => c.id);
    const missingIds = coursesToRegister.filter((id) => !foundIds.includes(id));
    throw new ErrorClass(
      `Some courses not found: ${missingIds.join(", ")}`,
      404
    );
  }

  // Validate each course
  const courseDetails = [];
  let totalAmount = 0;
  const errors = [];

  for (const course of courses) {
    // IMPORTANT: Check if WPU course is listed on marketplace
    if (
      (course.owner_type === "wpu" || course.owner_type === "wsp") &&
      course.is_marketplace === true &&
      course.marketplace_status === "published"
    ) {
      errors.push({
        course_id: course.id,
        course_code: course.course_code,
        error: "This WPU course is listed on marketplace and requires purchase",
      });
      continue;
    }

    // IMPORTANT: For non-marketplace WPU courses, students can only register for courses in their program
    if (
      (course.owner_type === "wpu" || course.owner_type === "wsp") &&
      (!course.is_marketplace || course.marketplace_status !== "published")
    ) {
      // Check if course matches student's program
      if (
        course.program_id &&
        student.program_id &&
        course.program_id !== student.program_id
      ) {
        errors.push({
          course_id: course.id,
          course_code: course.course_code,
          error: "This course is not part of your program",
        });
        continue;
      }
    }

    // IMPORTANT: Marketplace courses (sole_tutor/organization) require payment via purchase endpoint
    if (
      course.is_marketplace &&
      course.owner_type !== "wpu" &&
      course.owner_type !== "wsp"
    ) {
      errors.push({
        course_id: course.id,
        course_code: course.course_code,
        error: "This is a marketplace course and requires purchase",
      });
      continue;
    }

    // Check if already registered
    const existingReg = await CourseReg.findOne({
      where: {
        student_id: studentId,
        course_id: course.id,
        academic_year: academic_year,
        semester: semester,
      },
    });

    if (existingReg) {
      errors.push({
        course_id: course.id,
        course_code: course.course_code,
        error: "Already registered for this course",
      });
      continue;
    }

    // Get course price from courses.price
    const coursePrice = parseFloat(course.price) || 0;
    totalAmount += coursePrice;

    courseDetails.push({
      course_id: course.id,
      course_title: course.title,
      course_code: course.course_code,
      price: coursePrice,
      currency: course.currency || "NGN",
    });
  }

  // If there are errors, return them
  if (errors.length > 0) {
    throw new ErrorClass(
      `Some courses cannot be registered: ${errors.map((e) => e.course_code).join(", ")}`,
      400
    );
  }

  if (courseDetails.length === 0) {
    throw new ErrorClass("No valid courses to register", 400);
  }

  // Check wallet balance if total amount > 0
  if (totalAmount > 0) {
    const totalCredits = await Funding.sum("amount", {
      where: { student_id: studentId, type: "Credit" },
    });
    const totalDebits = await Funding.sum("amount", {
      where: { student_id: studentId, type: "Debit" },
    });
    const walletBalance = (totalCredits || 0) - (totalDebits || 0);

    if (walletBalance < totalAmount) {
      throw new ErrorClass(
        `Insufficient wallet balance. Required: ${totalAmount}, Available: ${walletBalance}`,
        400
      );
    }
  }

  // Create CourseOrder if payment is required
  let courseOrder = null;
  let funding = null;
  const registrationDate = new Date();
  const today = registrationDate.toISOString().split("T")[0];

  if (totalAmount > 0) {
    // Create CourseOrder
    courseOrder = await CourseOrder.create({
      student_id: studentId,
      amount: totalAmount.toString(),
      currency: student.currency || "NGN",
      date: registrationDate,
      semester: semester,
      academic_year: academic_year,
      level: level || student.level || "100",
    });

    // Create Funding transaction (Debit)
    const totalCredits = await Funding.sum("amount", {
      where: { student_id: studentId, type: "Credit" },
    });
    const totalDebits = await Funding.sum("amount", {
      where: { student_id: studentId, type: "Debit" },
    });
    const walletBalance = (totalCredits || 0) - (totalDebits || 0);

    funding = await Funding.create({
      student_id: studentId,
      amount: totalAmount,
      type: "Debit",
      service_name: "Course Registration",
      date: today,
      semester: semester,
      academic_year: academic_year,
      currency: student.currency || "NGN",
      balance: (walletBalance - totalAmount).toString(),
      ref: `COURSE-REG-${courseOrder.id}`,
    });

    // Update wallet balance
    await student.update({
      wallet_balance: walletBalance - totalAmount,
    });
  }

  // Create registrations for all courses
  const registrations = [];
  for (const courseDetail of courseDetails) {
    const registration = await CourseReg.create({
      student_id: studentId,
      course_id: courseDetail.course_id,
      academic_year: academic_year,
      semester: semester,
      level: level || student.level || "100",
      course_reg_id: courseOrder ? courseOrder.id : null,
      registration_status: "registered",
      registered_at: registrationDate,
      first_ca: 0,
      second_ca: 0,
      third_ca: 0,
      exam_score: 0,
      date: today,
    });

    registrations.push({
      id: registration.id,
      course_id: courseDetail.course_id,
      course_title: courseDetail.course_title,
      course_code: courseDetail.course_code,
      price: courseDetail.price,
    });
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: `Successfully registered for ${registrations.length} course(s)`,
    data: {
      total_amount: totalAmount,
      currency: student.currency || "NGN",
      course_count: registrations.length,
      courses: registrations,
      payment: totalAmount > 0 && courseOrder && funding
        ? {
            order_id: courseOrder.id,
            transaction_id: funding.id,
            amount_paid: totalAmount,
            previous_balance: parseFloat(funding.balance) + totalAmount,
            new_balance: parseFloat(funding.balance),
          }
        : null,
      note: totalAmount === 0
        ? "Free WPU courses - no payment required"
        : `Total payment: ${totalAmount} ${student.currency || "NGN"}`,
    },
  });
});

/**
 * STUDENT UNREGISTER FROM COURSE
 * DELETE /api/courses/register/:registrationId
 */
export const unregisterCourse = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const registrationId = Number(req.params.registrationId);

  if (userType !== "student") {
    throw new ErrorClass("Only students can unregister from courses", 403);
  }

  const registration = await CourseReg.findByPk(registrationId);

  if (!registration) {
    throw new ErrorClass("Registration not found", 404);
  }

  // Verify student owns this registration
  if (registration.student_id !== studentId) {
    throw new ErrorClass("Access denied", 403);
  }

  await registration.destroy();

  res.status(200).json({
    status: true,
    code: 200,
    message: "Course unregistered successfully",
  });
});

/**
 * GET AVAILABLE SEMESTERS
 * GET /api/courses/semesters
 */
export const getAvailableSemesters = TryCatchFunction(async (req, res) => {
  const semesters = await Semester.findAll({
    attributes: [
      "id",
      "academic_year",
      "semester",
      "status",
      "start_date",
      "end_date",
    ],
    order: [["start_date", "DESC"]],
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Semesters retrieved successfully",
    data: semesters,
  });
});

/**
 * GET ALL AVAILABLE COURSES FOR REGISTRATION
 * GET /api/courses/available
 */
export const getAvailableCourses = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  const { level, program_id, faculty_id } = req.query;

  const where = {};
  if (level) where.course_level = Number(level);

  const courses = await Courses.findAll({
    where: {
      ...where,
      // WPU students can see both WPU courses (free) and marketplace courses (paid)
      // Filter can be added later if needed
    },
    attributes: [
      "id",
      "title",
      "course_code",
      "course_unit",
      "course_type",
      "course_level",
      "semester",
      "price",
      "exam_fee",
      "currency",
      "staff_id",
      "owner_type",
      "is_marketplace",
      "marketplace_status",
    ],
    order: [["course_code", "ASC"]],
  });

  // Add pricing info for frontend - use courses.price directly
  const coursesWithPricing = courses.map((course) => {
    const courseData = course.toJSON();
    // Get price from courses.price column directly
    const coursePrice = parseFloat(course.price) || 0;
    const courseCurrency = course.currency || "NGN";
    
    // Always include price and currency
    courseData.price = coursePrice;
    courseData.currency = courseCurrency;
    
    if (course.owner_type === "wpu" || course.owner_type === "wsp") {
      // Check if WPU course is listed on marketplace
      if (course.is_marketplace === true && course.marketplace_status === "published") {
        // Marketplace WPU course - requires purchase
        courseData.requires_purchase = true;
        courseData.purchase_endpoint = "/api/marketplace/courses/purchase";
      } else {
        // Regular WPU course - use price from courses.price (can be 0 for free)
        courseData.requires_purchase = coursePrice > 0;
      }
    } else if (course.is_marketplace) {
      // Regular marketplace course (sole_tutor/organization)
      courseData.requires_purchase = true;
      courseData.purchase_endpoint = "/api/marketplace/courses/purchase";
    } else {
      courseData.requires_purchase = coursePrice > 0;
    }
    return courseData;
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Available courses retrieved successfully",
    data: coursesWithPricing,
    note: "WPU courses are free. Marketplace courses require purchase.",
  });
});
