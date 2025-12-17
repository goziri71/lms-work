import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { Semester } from "../../models/auth/semester.js";
import { CourseOrder } from "../../models/payment/courseOrder.js";
import { Funding } from "../../models/payment/funding.js";
import { CourseSemesterPricing } from "../../models/course/courseSemesterPricing.js";
import { checkSchoolFeesPayment } from "../../services/paymentVerificationService.js";

// Helper function to get course price for semester
const getCoursePriceForSemester = async (courseId, academicYear, semester) => {
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

  // Fallback to course base price if no semester pricing
  const course = await Courses.findByPk(courseId);
  if (course && course.price) {
    return parseFloat(course.price);
  }

  return 0;
};

/**
 * Get allocated courses for current student
 * GET /api/student/courses/allocated
 */
export const getMyAllocatedCourses = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  // Get current semester
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

  if (!currentSemester) {
    return res.status(200).json({
      success: true,
      message: "No active semester found",
      data: {
        semester: null,
        allocated_courses: [],
        total_amount: 0,
        registration_deadline: null,
        deadline_passed: false,
      },
    });
  }

  // Get allocated courses for current semester
  const allocatedCourses = await CourseReg.findAll({
    where: {
      student_id: studentId,
      academic_year: currentSemester.academic_year?.toString(),
      semester: currentSemester.semester?.toString(),
      registration_status: "allocated", // Only show unregistered allocations
    },
    include: [
      {
        model: Courses,
        as: "course",
        attributes: [
          "id",
          "title",
          "course_code",
          "course_unit",
          "program_id",
          "faculty_id",
        ],
      },
    ],
    order: [[{ model: Courses, as: "course" }, "course_code", "ASC"]],
  });

  // Calculate total amount
  let totalAmount = 0;
  const coursesWithDetails = allocatedCourses.map((allocation) => {
    const price = allocation.allocated_price
      ? parseFloat(allocation.allocated_price)
      : 0;
    totalAmount += price;

    return {
      allocation_id: allocation.id,
      course: {
        id: allocation.course?.id,
        title: allocation.course?.title,
        course_code: allocation.course?.course_code,
        course_unit: allocation.course?.course_unit,
      },
      price: price,
      allocated_at: allocation.allocated_at,
    };
  });

  // Check if deadline has passed
  const deadline = currentSemester.registration_deadline
    ? new Date(currentSemester.registration_deadline)
    : null;
  const deadlinePassed = deadline ? new Date() > deadline : false;

  res.status(200).json({
    success: true,
    message: "Allocated courses retrieved successfully",
    data: {
      semester: {
        id: currentSemester.id,
        academic_year: currentSemester.academic_year?.toString(),
        semester: currentSemester.semester?.toString(),
        status: currentSemester.status,
        registration_deadline: currentSemester.registration_deadline,
        deadline_passed: deadlinePassed,
      },
      allocated_courses: coursesWithDetails,
      total_amount: totalAmount,
      course_count: allocatedCourses.length,
      can_register: !deadlinePassed && allocatedCourses.length > 0,
    },
  });
});

/**
 * Register for all allocated courses (student self-process)
 * POST /api/student/courses/register-allocated
 */
export const registerAllocatedCourses = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can register for courses", 403);
  }

  // Get student
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get current semester
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

  if (!currentSemester) {
    throw new ErrorClass("No active semester found", 404);
  }

  // Check if student has paid school fees for this semester
  // School fees payment is required before course registration (per semester)
  const academicYear = currentSemester.academic_year?.toString();
  const semester = currentSemester.semester?.toString();
  const schoolFeesPaid = await checkSchoolFeesPayment(studentId, academicYear, semester);
  if (!schoolFeesPaid) {
    throw new ErrorClass(
      `You cannot register for courses. Please pay your school fees for ${academicYear} ${semester} first.`,
      400
    );
  }

  // Check registration deadline
  if (currentSemester.registration_deadline) {
    const deadline = new Date(currentSemester.registration_deadline);
    if (new Date() > deadline) {
      throw new ErrorClass(
        "Registration deadline has passed. Please contact admin to extend the deadline.",
        400
      );
    }
  }

  // Get all allocated courses for this semester
  const allocatedCourses = await CourseReg.findAll({
    where: {
      student_id: studentId,
      academic_year: currentSemester.academic_year?.toString(),
      semester: currentSemester.semester?.toString(),
      registration_status: "allocated",
    },
    include: [
      {
        model: Courses,
        as: "course",
        attributes: ["id", "title", "course_code", "price"],
      },
    ],
  });

  if (allocatedCourses.length === 0) {
    throw new ErrorClass(
      "No allocated courses found for current semester",
      404
    );
  }

  // Calculate total amount (use current prices, not allocated prices)
  let totalAmount = 0;
  const courseDetails = [];

  for (const allocation of allocatedCourses) {
    // Get current price (may have changed since allocation)
    const currentPrice = await getCoursePriceForSemester(
      allocation.course_id,
      currentSemester.academic_year?.toString(),
      currentSemester.semester?.toString()
    );

    totalAmount += currentPrice;
    courseDetails.push({
      allocation_id: allocation.id,
      course_id: allocation.course_id,
      course_code: allocation.course?.course_code,
      course_title: allocation.course?.title,
      price: currentPrice,
      allocated_price: allocation.allocated_price
        ? parseFloat(allocation.allocated_price)
        : null,
    });
  }

  // Check wallet balance
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

  // Create CourseOrder
  const courseOrder = await CourseOrder.create({
    student_id: studentId,
    amount: totalAmount.toString(),
    currency: student.currency || "NGN",
    date: new Date(),
    semester: currentSemester.semester?.toString(),
    academic_year: currentSemester.academic_year?.toString(),
    level: student.level,
  });

  // Create Funding transaction (Debit)
  const funding = await Funding.create({
    student_id: studentId,
    amount: totalAmount,
    type: "Debit",
    service_name: "Course Registration",
    date: today,
    semester: currentSemester.semester?.toString(),
    academic_year: currentSemester.academic_year?.toString(),
    currency: student.currency || "NGN",
    balance: (walletBalance - totalAmount).toString(),
    ref: `COURSE-REG-${courseOrder.id}`,
  });

  // Update wallet balance
  await student.update({
    wallet_balance: walletBalance - totalAmount,
  });

  // Update all CourseReg records to "registered"
  const registrationDate = new Date();
  for (const allocation of allocatedCourses) {
    // Get current price
    const currentPrice = await getCoursePriceForSemester(
      allocation.course_id,
      currentSemester.academic_year?.toString(),
      currentSemester.semester?.toString()
    );

    await allocation.update({
      registration_status: "registered",
      course_reg_id: courseOrder.id,
      registered_at: registrationDate,
      allocated_price: currentPrice, // Update to current price
    });
  }

  res.status(200).json({
    success: true,
    message: "All allocated courses registered successfully",
    data: {
      order: {
        id: courseOrder.id,
        amount: totalAmount,
        currency: courseOrder.currency,
        date: courseOrder.date,
      },
      courses: courseDetails,
      payment: {
        transaction_id: funding.id,
        amount_debited: totalAmount,
        previous_balance: walletBalance,
        new_balance: walletBalance - totalAmount,
      },
      registered_count: allocatedCourses.length,
    },
  });
});
