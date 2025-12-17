import { Courses } from "../../models/course/courses.js";
import { Students } from "../../models/auth/student.js";
import { CourseReg } from "../../models/course_reg.js";
import { processMarketplacePurchase } from "../../services/revenueSharingService.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";

/**
 * Purchase marketplace course
 * This handles payment processing and revenue distribution
 */
export const purchaseMarketplaceCourse = TryCatchFunction(async (req, res) => {
  const { course_id, payment_reference, payment_method } = req.body;
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

  // TODO: Integrate with payment gateway (Stripe, Paystack, etc.)
  // For now, we'll assume payment is successful
  // In production, verify payment_reference with payment gateway first

  // Process purchase and distribute revenue
  const result = await processMarketplacePurchase({
    course_id,
    student_id: studentId,
    payment_reference: payment_reference || `TXN-${Date.now()}`,
    payment_method: payment_method || "wallet",
  });

  // Enroll student in course with lifetime access (not tied to semester)
  const purchaseDate = new Date();
  const purchaseDateString = purchaseDate.toISOString().split("T")[0]; // Format: YYYY-MM-DD

  await CourseReg.create({
    student_id: studentId,
    course_id: course_id,
    academic_year: null, // Lifetime access - not tied to academic year
    semester: null, // Lifetime access - not tied to semester
    date: purchaseDateString, // Purchase date for reporting
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
    },
  });
});

