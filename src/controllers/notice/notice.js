import { Notice } from "../../models/notice/notice.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { Op } from "sequelize";

/**
 * Get active notices for students and staff
 * Only returns notices that are:
 * - status = 'active'
 * - Not expired (is_permanent = true OR expires_at > NOW())
 * - Matches target_audience
 * - System-wide (course_id = null) OR course-specific (if user is enrolled/teaching)
 */
export const getActiveNotices = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const courseIdParam = req.query?.course_id ? Number(req.query.course_id) : null;

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized", 401);
  }

  // Only students and staff can access this endpoint
  if (userType !== "student" && userType !== "staff") {
    throw new ErrorClass("Only students and staff can view notices", 403);
  }

  const now = new Date();

  // Get user's accessible course IDs
  let accessibleCourseIds = [];
  if (userType === "student") {
    // Get courses student is enrolled in
    const enrollments = await CourseReg.findAll({
      where: { student_id: userId },
      attributes: ["course_id"],
    });
    accessibleCourseIds = enrollments.map((e) => e.course_id);
  } else if (userType === "staff") {
    // Get courses staff is teaching
    const staffCourses = await Courses.findAll({
      where: { staff_id: userId },
      attributes: ["id"],
    });
    accessibleCourseIds = staffCourses.map((c) => c.id);
  }

  // Build course filter: system-wide (course_id = null) OR course-specific (if user has access)
  const courseFilter = [
    { course_id: null }, // System-wide notices
  ];

  // Add course-specific notices if user has accessible courses
  if (accessibleCourseIds.length > 0) {
    courseFilter.push({ course_id: { [Op.in]: accessibleCourseIds } });
  }

  // If course_id is specified in query, filter to that course (if user has access)
  if (courseIdParam) {
    if (!accessibleCourseIds.includes(courseIdParam)) {
      // User doesn't have access to this course, return empty
      return res.status(200).json({
        status: true,
        code: 200,
        message: "Notices retrieved successfully",
        data: [],
      });
    }
    // Override course filter to include only system-wide and the specific course
    courseFilter.length = 0;
    courseFilter.push(
      { course_id: null }, // System-wide
      { course_id: courseIdParam } // Specific course
    );
  }

  // Build where clause for active, non-expired notices
  const where = {
    status: "active",
    [Op.and]: [
      // Expiration check: permanent OR not expired OR no expiration date
      {
        [Op.or]: [
          { is_permanent: true },
          { expires_at: { [Op.gt]: now } },
          { expires_at: null },
        ],
      },
      // Target audience filter
      userType === "student"
        ? { target_audience: { [Op.in]: ["all", "students", "both"] } }
        : { target_audience: { [Op.in]: ["all", "staff", "both"] } },
      // Course filter
      {
        [Op.or]: courseFilter,
      },
    ],
  };

  const notices = await Notice.findAll({
    where,
    include: [
      {
        model: Courses,
        as: "course",
        attributes: ["id", "title", "course_code"],
        required: false,
      },
    ],
    order: [["date", "DESC"]],
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Notices retrieved successfully",
    data: notices,
  });
});

