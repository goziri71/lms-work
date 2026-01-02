import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { Staff } from "../../models/auth/staff.js";
import { Op } from "sequelize";
import { checkCourseFeesPayment } from "../../services/paymentVerificationService.js";

/**
 * Get student's purchased marketplace courses (lifetime access)
 * GET /api/marketplace/courses/my-courses
 */
export const getMyMarketplaceCourses = TryCatchFunction(async (req, res) => {
  const parsedStudentId = Number(req.user?.id);
  const { owner_id, owner_type } = req.query;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  if (!Number.isInteger(parsedStudentId) || parsedStudentId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }

  // Verify student exists
  const student = await Students.findByPk(parsedStudentId, {
    attributes: ["id"],
  });
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Build where clause for CourseReg
  const courseRegWhere = {
    student_id: parsedStudentId,
    registration_status: "marketplace_purchased",
    // Lifetime access - academic_year and semester should be NULL
    academic_year: null,
    semester: null,
  };

  // Build where clause for Courses (filter by owner if provided)
  const courseWhere = {};
  if (owner_id && owner_type) {
    courseWhere.owner_id = Number(owner_id);
    courseWhere.owner_type = owner_type;
  }

  // Get marketplace course enrollments
  const marketplaceEnrollments = await CourseReg.findAll({
    where: courseRegWhere,
    include: [
      {
        model: Courses,
        as: "course",
        required: true, // Only include if course exists
        where: {
          ...courseWhere,
          is_marketplace: true,
          marketplace_status: "published",
        },
        include: [
          {
            model: Staff,
            as: "instructor",
            attributes: ["id", "full_name", "email", "phone"],
            required: false,
          },
        ],
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
          "owner_type",
          "owner_id",
          "is_marketplace",
          "marketplace_status",
          "description",
          "pricing_type",
          "course_outline",
          "duration_days",
          "image_url",
          "category",
          "enrollment_limit",
          "access_duration_days",
        ],
      },
    ],
    order: [["date", "DESC"]], // Most recent purchases first
  });

  // Format response with paid status
  const coursesWithPaidStatus = await Promise.all(
    marketplaceEnrollments.map(async (enrollment) => {
      const course = enrollment.course;
      if (!course) return null;

      const courseData = course.toJSON();
      const registration = enrollment.toJSON();

      // Marketplace courses are always paid (enrollment = payment)
      // But we still check to be consistent with payment verification logic
      const paymentStatus = await checkCourseFeesPayment(
        parsedStudentId,
        courseData.id,
        null, // academic_year is NULL for marketplace
        null // semester is NULL for marketplace
      );

      return {
        ...courseData,
        registration: {
          id: registration.id,
          date: registration.date, // Purchase date
          registration_status: registration.registration_status,
          access_type: "lifetime", // Lifetime access indicator
          purchased_at: registration.date,
        },
        paid: paymentStatus.paid,
        instructor: courseData.instructor,
      };
    })
  );

  // Filter out null entries
  const validCourses = coursesWithPaidStatus.filter((course) => course !== null);

  res.status(200).json({
    status: true,
    code: 200,
    message: "Marketplace courses retrieved successfully",
    data: validCourses,
    meta: {
      total: validCourses.length,
      filters: {
        ...(owner_id && owner_type ? { owner_id, owner_type } : {}),
      },
    },
  });
});

