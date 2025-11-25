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

  // Only marketplace courses (sole_tutor or organization) require payment
  // WPU courses are free for WPU students
  if (!course.is_marketplace || course.owner_type === "wpu" || course.owner_type === "wsp") {
    throw new ErrorClass(
      "This is a WPU course and is free. Please use the registration endpoint: POST /api/courses/register",
      400
    );
  }

  if (course.marketplace_status !== "published") {
    throw new ErrorClass("This course is not available for purchase", 400);
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

  res.status(201).json({
    success: true,
    message: "Course purchased and enrollment successful",
    data: {
      transaction: {
        id: result.transaction.id,
        course_price: result.revenue.coursePrice,
        wsp_commission: result.revenue.wspCommission,
        tutor_earnings: result.revenue.tutorEarnings,
        commission_rate: result.revenue.commissionRate,
      },
      enrollment: {
        course_id: course_id,
        academic_year: academicYear,
        semester: semester,
      },
    },
  });
});

