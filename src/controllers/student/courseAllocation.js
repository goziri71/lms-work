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
import { GeneralSetup } from "../../models/settings/generalSetup.js";
import { checkSchoolFeesPayment } from "../../services/paymentVerificationService.js";
import { checkAndProgressStudentLevel } from "../../services/studentLevelProgressionService.js";
import { getWalletBalance } from "../../services/walletBalanceService.js";

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
          "currency",
        ],
      },
    ],
    order: [[{ model: Courses, as: "course" }, "course_code", "ASC"]],
  });

  // Get exchange rate for currency conversion
  const generalSetup = await GeneralSetup.findOne({
    order: [["id", "DESC"]],
  });
  const exchangeRate = parseFloat(generalSetup?.rate || "1500");
  
  // Get student currency
  const student = await Students.findByPk(studentId, {
    attributes: ["currency"],
  });
  const studentCurrency = (student?.currency || "NGN").toUpperCase();

  // Calculate total amount using CURRENT prices (not allocated prices)
  let totalAmount = 0;
  const coursesWithDetails = await Promise.all(
    allocatedCourses.map(async (allocation) => {
      // Get current price for this course in this semester
      const semesterPricing = await CourseSemesterPricing.findOne({
        where: {
          course_id: allocation.course_id,
          academic_year: currentSemester.academic_year?.toString(),
          semester: currentSemester.semester?.toString(),
        },
      });

      let currentPrice = 0;
      let courseCurrency = "NGN";

      if (semesterPricing) {
        currentPrice = parseFloat(semesterPricing.price) || 0;
        courseCurrency = (semesterPricing.currency || allocation.course?.currency || "NGN").toUpperCase();
      } else {
        // Fallback to course base price
        currentPrice = await getCoursePriceForSemester(
          allocation.course_id,
          currentSemester.academic_year?.toString(),
          currentSemester.semester?.toString()
        );
        courseCurrency = (allocation.course?.currency || "NGN").toUpperCase();
      }

      // Convert price to student's currency if they differ
      let priceInStudentCurrency = currentPrice;
      if (courseCurrency !== studentCurrency) {
        if (courseCurrency === "USD" && studentCurrency === "NGN") {
          priceInStudentCurrency = currentPrice * exchangeRate;
        } else if (courseCurrency === "NGN" && studentCurrency === "USD") {
          priceInStudentCurrency = currentPrice / exchangeRate;
        }
        priceInStudentCurrency = Math.round(priceInStudentCurrency * 100) / 100;
      }

      totalAmount += priceInStudentCurrency;

      return {
        allocation_id: allocation.id,
        course: {
          id: allocation.course?.id,
          title: allocation.course?.title,
          course_code: allocation.course?.course_code,
          course_unit: allocation.course?.course_unit,
        },
        price: priceInStudentCurrency,
        currency: studentCurrency,
        allocated_price: allocation.allocated_price
          ? parseFloat(allocation.allocated_price)
          : null,
        allocated_at: allocation.allocated_at,
      };
    })
  );

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
 * Register for selected allocated courses (student self-process)
 * POST /api/student/courses/register-allocated
 * Body: { allocation_ids: [123, 124, 125] } - Array of allocation IDs to register
 */
export const registerAllocatedCourses = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const { allocation_ids } = req.body;

  if (userType !== "student") {
    throw new ErrorClass("Only students can register for courses", 403);
  }

  // Validate allocation_ids
  if (!allocation_ids || !Array.isArray(allocation_ids) || allocation_ids.length === 0) {
    throw new ErrorClass(
      "Please select at least one course to register. Provide allocation_ids as an array.",
      400
    );
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

  // Check and progress student level if eligible (before registration)
  // This checks if student has completed both semesters of previous academic year
  const academicYear = currentSemester.academic_year?.toString();
  const semester = currentSemester.semester?.toString();
  const levelProgression = await checkAndProgressStudentLevel(studentId, academicYear);
  
  // Reload student to get updated level if progression occurred
  if (levelProgression.progressed) {
    await student.reload();
    console.log(`✅ Student ${studentId} level progressed: ${levelProgression.previousLevel} → ${levelProgression.newLevel}`);
  }

  // Check if student has paid school fees for this semester
  // School fees payment is required before course registration (per semester)
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

  // Get selected allocated courses (validate they belong to student and are still allocated)
  const allocatedCourses = await CourseReg.findAll({
    where: {
      id: allocation_ids,
      student_id: studentId,
      academic_year: currentSemester.academic_year?.toString(),
      semester: currentSemester.semester?.toString(),
      registration_status: "allocated",
    },
    include: [
      {
        model: Courses,
        as: "course",
        attributes: ["id", "title", "course_code", "price", "currency"],
      },
    ],
  });

  if (allocatedCourses.length === 0) {
    throw new ErrorClass(
      "No valid allocated courses found. The selected courses may have already been registered or do not belong to you.",
      404
    );
  }

  // Check if all requested allocation_ids were found
  if (allocatedCourses.length !== allocation_ids.length) {
    const foundIds = allocatedCourses.map((a) => a.id);
    const missingIds = allocation_ids.filter((id) => !foundIds.includes(id));
    throw new ErrorClass(
      `Some selected courses could not be found or have already been registered. Missing IDs: ${missingIds.join(", ")}`,
      400
    );
  }

  // Get exchange rate for currency conversion
  const generalSetup = await GeneralSetup.findOne({
    order: [["id", "DESC"]],
  });
  const exchangeRate = parseFloat(generalSetup?.rate || "1500"); // Default 1500 if not set

  // Get student currency
  const studentCurrency = (student.currency || "NGN").toUpperCase();

  // Calculate total amount (use current prices, not allocated prices)
  // But convert to student's currency
  let totalAmount = 0;
  const courseDetails = [];

  for (const allocation of allocatedCourses) {
    // Get current price and currency (may have changed since allocation)
    // First check CourseSemesterPricing for currency
    const semesterPricing = await CourseSemesterPricing.findOne({
      where: {
        course_id: allocation.course_id,
        academic_year: currentSemester.academic_year?.toString(),
        semester: currentSemester.semester?.toString(),
      },
    });

    let currentPrice = 0;
    let courseCurrency = "NGN";

    if (semesterPricing) {
      currentPrice = parseFloat(semesterPricing.price) || 0;
      courseCurrency = (semesterPricing.currency || allocation.course?.currency || "NGN").toUpperCase();
    } else {
      // Fallback to course base price
      currentPrice = await getCoursePriceForSemester(
        allocation.course_id,
        currentSemester.academic_year?.toString(),
        currentSemester.semester?.toString()
      );
      // Get currency from included course or fetch if not included
      if (allocation.course?.currency) {
        courseCurrency = allocation.course.currency.toUpperCase();
      } else {
        // Fallback: fetch course if currency not in include
        const course = await Courses.findByPk(allocation.course_id, {
          attributes: ["currency"],
        });
        courseCurrency = (course?.currency || "NGN").toUpperCase();
      }
    }

    // Convert price to student's currency if they differ
    let priceInStudentCurrency = currentPrice;
    if (courseCurrency !== studentCurrency) {
      if (courseCurrency === "USD" && studentCurrency === "NGN") {
        // USD to NGN: multiply by exchange rate
        priceInStudentCurrency = currentPrice * exchangeRate;
      } else if (courseCurrency === "NGN" && studentCurrency === "USD") {
        // NGN to USD: divide by exchange rate
        priceInStudentCurrency = currentPrice / exchangeRate;
      }
      // Round to 2 decimal places
      priceInStudentCurrency = Math.round(priceInStudentCurrency * 100) / 100;
    }

    totalAmount += priceInStudentCurrency;
    courseDetails.push({
      allocation_id: allocation.id,
      course_id: allocation.course_id,
      course_code: allocation.course?.course_code,
      course_title: allocation.course?.title,
      price: priceInStudentCurrency,
      allocated_price: allocation.allocated_price
        ? parseFloat(allocation.allocated_price)
        : null,
    });
  }

  // Check wallet balance (with automatic migration of old balances)
  const { balance: walletBalance } = await getWalletBalance(studentId, true);

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

  // Generate transaction reference for course registration
  const txRef = `COURSE-REG-${Date.now()}`;

  // Create Funding transaction (Debit)
  const funding = await Funding.create({
    student_id: studentId,
    amount: totalAmount, // DECIMAL(10, 2) - supports decimal amounts accurately
    type: "Debit",
    service_name: "Course Registration",
    date: today,
    semester: currentSemester.semester?.toString(),
    academic_year: currentSemester.academic_year?.toString(),
    currency: studentCurrency,
    balance: (walletBalance - totalAmount).toString(),
    ref: txRef,
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
    message: `Successfully registered for ${allocatedCourses.length} course(s)`,
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
