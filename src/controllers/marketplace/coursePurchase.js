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

  // Check if already enrolled
  const existingEnrollment = await CourseReg.findOne({
    where: {
      student_id: studentId,
      course_id: course_id,
    },
  });

  if (existingEnrollment) {
    throw new ErrorClass("You are already enrolled in this course", 400);
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

  // Enroll student in course
  const currentDate = new Date();
  const academicYear = `${currentDate.getFullYear()}/${currentDate.getFullYear() + 1}`;
  const semester = currentDate.getMonth() < 6 ? "1ST" : "2ND";

  await CourseReg.create({
    student_id: studentId,
    course_id: course_id,
    academic_year: academicYear,
    semester: semester,
    date: currentDate,
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
        academic_year: academicYear,
        semester: semester,
      },
    },
  });
});

