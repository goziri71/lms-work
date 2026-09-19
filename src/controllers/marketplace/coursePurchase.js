import { Courses } from "../../models/course/courses.js";
import { Students } from "../../models/auth/student.js";
import { CourseReg } from "../../models/course_reg.js";
import { Funding } from "../../models/payment/funding.js";
import { GeneralSetup } from "../../models/settings/generalSetup.js";
import { processMarketplacePurchase } from "../../services/revenueSharingService.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { getWalletBalance } from "../../services/walletBalanceService.js";

/**
 * Purchase marketplace course
 * This handles payment processing and revenue distribution
 */
export const purchaseMarketplaceCourse = TryCatchFunction(async (req, res) => {
  const { course_id } = req.body;
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can purchase courses", 403);
  }

  if (!course_id) {
    throw new ErrorClass("Course ID is required", 400);
  }

  // Verify course exists and is a marketplace course
  const course = await Courses.findByPk(course_id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  // Check if course is available on marketplace
  if (!course.is_marketplace || course.marketplace_status !== "published") {
    throw new ErrorClass("This course is not available on marketplace", 400);
  }

  // Validate course price (0 = free course)
  const coursePrice = parseFloat(course.price || 0);
  if (Number.isNaN(coursePrice) || coursePrice < 0) {
    throw new ErrorClass("Course price is invalid or not set", 400);
  }
  const isFree = coursePrice === 0 || course.pricing_type === "free";

  // Verify student exists
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get exchange rate from system settings (USD to NGN)
  const generalSetup = await GeneralSetup.findOne({
    order: [["id", "DESC"]],
  });
  const exchangeRate = parseFloat(generalSetup?.rate || "1500"); // Default 1500 if not set

  // Get currencies
  const courseCurrency = (course.currency || "NGN").toUpperCase();
  const studentCurrency = (student.currency || "NGN").toUpperCase();

  // Convert course price to student's currency if they differ
  let priceInStudentCurrency = coursePrice;
  if (courseCurrency !== studentCurrency) {
    if (courseCurrency === "USD" && studentCurrency === "NGN") {
      // USD to NGN: multiply by exchange rate
      priceInStudentCurrency = coursePrice * exchangeRate;
    } else if (courseCurrency === "NGN" && studentCurrency === "USD") {
      // NGN to USD: divide by exchange rate
      priceInStudentCurrency = coursePrice / exchangeRate;
    }
    // Round to 2 decimal places to avoid floating point precision issues
    priceInStudentCurrency = Math.round(priceInStudentCurrency * 100) / 100;
  }

  // Check if already purchased from marketplace (lifetime access - no duplicate purchases)
  const existingMarketplacePurchase = await CourseReg.findOne({
    where: {
      student_id: studentId,
      course_id: course_id,
      registration_status: "marketplace_purchased",
    },
  });

  if (existingMarketplacePurchase) {
    throw new ErrorClass("You already own this course. Marketplace courses provide lifetime access.", 400);
  }

  // Check enrollment limit (only for marketplace purchases)
  if (course.enrollment_limit !== null && course.enrollment_limit !== undefined) {
    const currentEnrollments = await CourseReg.count({
      where: {
        course_id: course_id,
        registration_status: "marketplace_purchased",
      },
    });

    if (currentEnrollments >= course.enrollment_limit) {
      throw new ErrorClass(
        `This course has reached its enrollment limit of ${course.enrollment_limit} students.`,
        400
      );
    }
  }

  // All transactions use wallet balance (Flutterwave only funds wallet)
  // Free courses skip wallet debit and revenue sharing
  let walletBalance = 0;
  let newBalance = 0;
  let txRef = null;
  let result = null;

  if (!isFree) {
    const wallet = await getWalletBalance(studentId, true);
    walletBalance = wallet.balance;

    if (walletBalance < priceInStudentCurrency) {
      let requiredDisplay;
      if (courseCurrency !== studentCurrency) {
        requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency} (${coursePrice} ${courseCurrency})`;
      } else {
        requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency}`;
      }

      throw new ErrorClass(
        `Insufficient wallet balance. Required: ${requiredDisplay}, Available: ${walletBalance.toFixed(2)} ${studentCurrency}. Please fund your wallet first.`,
        400
      );
    }

    txRef = `MARKETPLACE-${course_id}-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];
    newBalance = walletBalance - priceInStudentCurrency;

    await Funding.create({
      student_id: studentId,
      amount: priceInStudentCurrency,
      type: "Debit",
      service_name: "Marketplace Course Purchase",
      ref: txRef,
      date: today,
      semester: null,
      academic_year: null,
      currency: studentCurrency,
      balance: newBalance.toString(),
    });

    await student.update({
      wallet_balance: newBalance,
    });

    result = await processMarketplacePurchase({
      course_id,
      student_id: studentId,
      payment_reference: txRef,
      payment_method: "wallet",
    });
  } else {
    txRef = `MARKETPLACE-FREE-${course_id}-${Date.now()}`;
  }

  // Enroll student in course with lifetime access (not tied to semester)
  const purchaseDate = new Date();
  const purchaseDateString = purchaseDate.toISOString().split("T")[0];

  await CourseReg.create({
    student_id: studentId,
    course_id: course_id,
    academic_year: null,
    semester: null,
    date: purchaseDateString,
    registration_status: "marketplace_purchased",
    course_reg_id: null,
    program_id: null,
    facaulty_id: null,
    level: null,
    first_ca: 0,
    second_ca: 0,
    third_ca: 0,
    exam_score: 0,
  });

  const isWPUCourse = course.owner_type === "wpu" || course.owner_type === "wsp";

  res.status(201).json({
    success: true,
    message: isFree
      ? "Free course enrolled successfully"
      : "Course purchased and enrollment successful",
    data: {
      transaction: result
        ? {
            id: result.transaction.id,
            course_price: result.revenue.coursePrice,
            wsp_commission: result.revenue.wspCommission,
            tutor_earnings: isWPUCourse ? null : result.revenue.tutorEarnings,
            commission_rate: result.revenue.commissionRate,
            owner_type: course.owner_type,
            note: isWPUCourse
              ? "WPU marketplace course - 100% revenue to WPU"
              : "Regular marketplace course - commission split applied",
          }
        : {
            id: null,
            course_price: 0,
            wsp_commission: 0,
            tutor_earnings: 0,
            commission_rate: 0,
            owner_type: course.owner_type,
            note: "Free course - no payment required",
          },
      enrollment: {
        course_id: course_id,
        access_type: "lifetime",
        purchased_at: purchaseDateString,
        is_free: isFree,
      },
      wallet: isFree
        ? null
        : {
            previous_balance: walletBalance,
            new_balance: newBalance,
            debited: priceInStudentCurrency,
            currency: studentCurrency,
            course_price_original:
              courseCurrency !== studentCurrency
                ? {
                    amount: coursePrice,
                    currency: courseCurrency,
                  }
                : null,
          },
    },
  });
});

