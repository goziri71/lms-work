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

  // Validate course price
  const coursePrice = parseFloat(course.price || 0);
  if (coursePrice <= 0) {
    throw new ErrorClass("Course price is invalid or not set", 400);
  }

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

  // All transactions use wallet balance (Flutterwave only funds wallet)
  // Check wallet balance (with automatic migration of old balances)
  // Wallet balance is always in student's currency
  const { balance: walletBalance } = await getWalletBalance(studentId, true);

  // Check if wallet has sufficient balance (compare in student's currency)
  if (walletBalance < priceInStudentCurrency) {
    // Format amounts for display - always show in student's currency first
    let requiredDisplay;
    if (courseCurrency !== studentCurrency) {
      // Show converted amount in student's currency, with original in parentheses
      requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency} (${coursePrice} ${courseCurrency})`;
    } else {
      // Same currency - just show the amount
      requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency}`;
    }
    
    throw new ErrorClass(
      `Insufficient wallet balance. Required: ${requiredDisplay}, Available: ${walletBalance.toFixed(2)} ${studentCurrency}. Please fund your wallet first.`,
      400
    );
  }

  // Generate transaction reference for wallet debit
  const txRef = `MARKETPLACE-${course_id}-${Date.now()}`;
  const today = new Date().toISOString().split("T")[0];

  // Debit wallet (in student's currency)
  const newBalance = walletBalance - priceInStudentCurrency;

  // Create Funding transaction (Debit) - store in student's currency
  await Funding.create({
    student_id: studentId,
    amount: priceInStudentCurrency, // DECIMAL(10, 2) - supports decimal amounts accurately
    type: "Debit",
    service_name: "Marketplace Course Purchase",
    ref: txRef,
    date: today,
    semester: null, // Marketplace courses are not tied to semester
    academic_year: null, // Marketplace courses are not tied to academic year
    currency: studentCurrency, // Store in student's currency
    balance: newBalance.toString(),
  });

  // Update student wallet_balance
  await student.update({
    wallet_balance: newBalance,
  });

  // Process marketplace purchase and distribute revenue
  const result = await processMarketplacePurchase({
    course_id,
    student_id: studentId,
    payment_reference: txRef,
    payment_method: "wallet", // Always wallet for marketplace purchases
  });

  // Enroll student in course with lifetime access (not tied to semester)
  const purchaseDate = new Date();
  const purchaseDateString = purchaseDate.toISOString().split("T")[0];

  await CourseReg.create({
    student_id: studentId,
    course_id: course_id,
    academic_year: null, // Lifetime access - not tied to academic year
    semester: null, // Lifetime access - not tied to semester
    date: purchaseDateString,
    registration_status: "marketplace_purchased",
    course_reg_id: null, // No CourseOrder (marketplace uses MarketplaceTransaction)
    program_id: null, // Not part of program allocation
    facaulty_id: null,
    level: null,
    first_ca: 0,
    second_ca: 0,
    third_ca: 0,
    exam_score: 0,
  });

  // Build response based on course type
  const isWPUCourse = course.owner_type === "wpu" || course.owner_type === "wsp";
  
  res.status(201).json({
    success: true,
    message: "Course purchased and enrollment successful",
    data: {
      transaction: {
        id: result.transaction.id,
        course_price: result.revenue.coursePrice,
        wsp_commission: result.revenue.wspCommission,
        tutor_earnings: isWPUCourse ? null : result.revenue.tutorEarnings, // Null for WPU courses
        commission_rate: result.revenue.commissionRate,
        owner_type: course.owner_type,
        note: isWPUCourse 
          ? "WPU marketplace course - 100% revenue to WPU" 
          : "Regular marketplace course - commission split applied",
      },
      enrollment: {
        course_id: course_id,
        access_type: "lifetime", // Lifetime access - not tied to semester
        purchased_at: purchaseDateString,
      },
      wallet: {
        previous_balance: walletBalance,
        new_balance: newBalance,
        debited: priceInStudentCurrency,
        currency: studentCurrency,
        course_price_original: courseCurrency !== studentCurrency ? {
          amount: coursePrice,
          currency: courseCurrency,
        } : null,
      },
    },
  });
});

