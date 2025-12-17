import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { Staff } from "../../models/auth/staff.js";
import { Op } from "sequelize";

/**
 * Browse all available marketplace courses
 * GET /api/marketplace/courses
 * 
 * Returns all published marketplace courses that students can purchase
 * Shows which courses the student already owns
 */
export const browseMarketplaceCourses = TryCatchFunction(async (req, res) => {
  const parsedStudentId = Number(req.user?.id);
  const { owner_id, owner_type, level, program_id, search, page = 1, limit = 20 } = req.query;

  // Optional: Only students can browse (or make it public)
  if (req.user?.userType && req.user?.userType !== "student") {
    throw new ErrorClass("Only students can browse marketplace courses", 403);
  }

  // If student is logged in, verify they exist
  if (parsedStudentId && parsedStudentId > 0) {
    const student = await Students.findByPk(parsedStudentId, {
      attributes: ["id"],
    });
    if (!student) {
      throw new ErrorClass("Student not found", 404);
    }
  }

  // Build where clause for marketplace courses
  const courseWhere = {
    is_marketplace: true,
    marketplace_status: "published",
  };

  // Apply filters
  if (owner_id && owner_type) {
    courseWhere.owner_id = Number(owner_id);
    courseWhere.owner_type = owner_type;
  }

  if (level) {
    courseWhere.course_level = Number(level);
  }

  if (program_id) {
    courseWhere.program_id = Number(program_id);
  }

  // Search filter
  if (search) {
    courseWhere[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { course_code: { [Op.iLike]: `%${search}%` } },
    ];
  }

  // Get total count for pagination
  const totalCount = await Courses.count({
    where: courseWhere,
  });

  // Calculate pagination
  const offset = (Number(page) - 1) * Number(limit);
  const totalPages = Math.ceil(totalCount / Number(limit));

  // Get all published marketplace courses
  const courses = await Courses.findAll({
    where: courseWhere,
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
      "program_id",
      "faculty_id",
    ],
    order: [["title", "ASC"]],
    limit: Number(limit),
    offset: offset,
  });

  // If student is logged in, check which courses they already own
  let ownedCourseIds = [];
  if (parsedStudentId && parsedStudentId > 0) {
    const ownedCourses = await CourseReg.findAll({
      where: {
        student_id: parsedStudentId,
        registration_status: "marketplace_purchased",
        academic_year: null,
        semester: null,
      },
      attributes: ["course_id"],
    });
    ownedCourseIds = ownedCourses.map((reg) => reg.course_id);
  }

  // Format response with ownership status
  const coursesWithOwnership = courses.map((course) => {
    const courseData = course.toJSON();
    const isOwned = ownedCourseIds.includes(courseData.id);
    const coursePrice = parseFloat(course.price) || 0;

    return {
      ...courseData,
      price: coursePrice,
      is_owned: isOwned, // Whether student already owns this course
      requires_purchase: !isOwned && coursePrice > 0, // Needs purchase if not owned and has price
      purchase_endpoint: !isOwned ? "/api/marketplace/courses/purchase" : null,
      instructor: courseData.instructor,
    };
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Marketplace courses retrieved successfully",
    data: coursesWithOwnership,
    meta: {
      total: totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: totalPages,
      hasNextPage: Number(page) < totalPages,
      hasPrevPage: Number(page) > 1,
      filters: {
        ...(owner_id && owner_type ? { owner_id, owner_type } : {}),
        ...(level ? { level } : {}),
        ...(program_id ? { program_id } : {}),
        ...(search ? { search } : {}),
      },
    },
  });
});

