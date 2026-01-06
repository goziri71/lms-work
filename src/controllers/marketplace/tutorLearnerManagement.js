/**
 * Tutor Learner Management Controller
 * Allows tutors to view and monitor their learners' activity
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { MarketplaceTransaction } from "../../models/marketplace/marketplaceTransaction.js";
import { LearnerActivityLog } from "../../models/marketplace/learnerActivityLog.js";
import { CourseProgress } from "../../models/marketplace/courseProgress.js";
import { LearnerLoginHistory } from "../../models/marketplace/learnerLoginHistory.js";
import { db } from "../../database/database.js";
import { Op } from "sequelize";

/**
 * Helper to get tutor info
 */
function getTutorInfo(req) {
  const userType = req.user.userType;
  let tutorId, tutorType;

  if (userType === "sole_tutor") {
    tutorId = req.tutor.id;
    tutorType = "sole_tutor";
  } else if (userType === "organization") {
    tutorId = req.tutor.id;
    tutorType = "organization";
  } else if (userType === "organization_user") {
    tutorId = req.tutor.organization_id;
    tutorType = "organization";
  } else {
    throw new ErrorClass("Invalid user type", 403);
  }

  return { tutorId, tutorType };
}

/**
 * Get all learners who purchased courses from tutor
 * GET /api/marketplace/tutor/learners
 */
export const getMyLearners = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { page = 1, limit = 20, search, course_id } = req.query;

  // Get all courses owned by this tutor
  const courseWhere = {
    owner_id: tutorId,
    owner_type: tutorType,
    is_marketplace: true,
  };

  if (course_id) {
    courseWhere.id = parseInt(course_id);
  }

  const tutorCourses = await Courses.findAll({
    where: courseWhere,
    attributes: ["id"],
  });

  if (tutorCourses.length === 0) {
    return res.json({
      success: true,
      data: {
        learners: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
        },
      },
    });
  }

  const courseIds = tutorCourses.map((c) => c.id);

  // Get all students enrolled in these courses
  // Check both CourseReg (enrollments) and MarketplaceTransaction (purchases)
  const enrollmentWhere = {
    course_id: { [Op.in]: courseIds },
    registration_status: "marketplace_purchased",
  };

  // Get unique student IDs from CourseReg
  const enrollments = await CourseReg.findAll({
    where: enrollmentWhere,
    attributes: ["student_id"],
    group: ["student_id"],
    raw: true,
  });

  // Also get student IDs from MarketplaceTransaction (in case CourseReg wasn't created)
  const transactions = await MarketplaceTransaction.findAll({
    where: {
      course_id: { [Op.in]: courseIds },
      owner_id: tutorId,
      owner_type: tutorType,
      payment_status: "completed",
    },
    attributes: ["student_id"],
    group: ["student_id"],
    raw: true,
  });

  // Combine and get unique student IDs
  const enrollmentStudentIds = enrollments.map((e) => e.student_id);
  const transactionStudentIds = transactions.map((t) => t.student_id);
  const studentIds = [...new Set([...enrollmentStudentIds, ...transactionStudentIds])];

  if (studentIds.length === 0) {
    return res.json({
      success: true,
      data: {
        learners: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
        },
      },
    });
  }

  // Build student search query
  const studentWhere = {
    id: { [Op.in]: studentIds },
  };

  if (search) {
    studentWhere[Op.or] = [
      { fname: { [Op.iLike]: `%${search}%` } },
      { lname: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { matric_number: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Get students with their course progress
  const { count, rows: students } = await Students.findAndCountAll({
    where: studentWhere,
    attributes: [
      "id",
      "fname",
      "mname",
      "lname",
      "email",
      "matric_number",
      "phone",
      "country",
      "date",
    ],
    limit: parseInt(limit),
    offset,
    order: [["date", "DESC"]],
    include: [
      {
        model: CourseProgress,
        as: "courseProgress",
        where: {
          course_id: { [Op.in]: courseIds },
          tutor_id: tutorId,
          tutor_type: tutorType,
        },
        required: false,
        attributes: [
          "course_id",
          "completion_percentage",
          "is_completed",
          "last_accessed_at",
          "total_time_spent_seconds",
        ],
        include: [
          {
            model: Courses,
            as: "course",
            attributes: ["id", "title", "course_code"],
          },
        ],
      },
    ],
  });

  // Format response
  const learners = students.map((student) => {
    const name = `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim() || student.email;

    return {
      id: student.id,
      name: name,
      email: student.email,
      matric_number: student.matric_number,
      phone: student.phone,
      country: student.country,
      joined_at: student.date,
      courses: student.courseProgress?.map((progress) => ({
        course_id: progress.course_id,
        course_title: progress.course?.title,
        course_code: progress.course?.course_code,
        completion_percentage: parseFloat(progress.completion_percentage || 0),
        is_completed: progress.is_completed,
        last_accessed_at: progress.last_accessed_at,
        time_spent_hours: Math.round((progress.total_time_spent_seconds || 0) / 3600 * 100) / 100,
      })) || [],
    };
  });

  res.json({
    success: true,
    message: "Learners retrieved successfully",
    data: {
      learners,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

/**
 * Get learner details and activity
 * GET /api/marketplace/tutor/learners/:learnerId
 */
export const getLearnerDetails = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { learnerId } = req.params;

  // Verify learner purchased courses from this tutor
  const tutorCourses = await Courses.findAll({
    where: {
      owner_id: tutorId,
      owner_type: tutorType,
      is_marketplace: true,
    },
    attributes: ["id"],
  });

  if (tutorCourses.length === 0) {
    throw new ErrorClass("No courses found for this tutor", 404);
  }

  const courseIds = tutorCourses.map((c) => c.id);

  const enrollment = await CourseReg.findOne({
    where: {
      student_id: parseInt(learnerId),
      course_id: { [Op.in]: courseIds },
      registration_status: "marketplace_purchased",
    },
  });

  if (!enrollment) {
    throw new ErrorClass("Learner not found or has not purchased any courses from you", 404);
  }

  // Get learner info
  const learner = await Students.findByPk(learnerId, {
    attributes: [
      "id",
      "fname",
      "mname",
      "lname",
      "email",
      "matric_number",
      "phone",
      "country",
      "state_origin",
      "date",
    ],
  });

  if (!learner) {
    throw new ErrorClass("Learner not found", 404);
  }

  // Get course progress
  const progress = await CourseProgress.findAll({
    where: {
      student_id: parseInt(learnerId),
      course_id: { [Op.in]: courseIds },
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
    include: [
      {
        model: Courses,
        as: "course",
        attributes: ["id", "title", "course_code", "image_url"],
      },
    ],
    order: [["last_accessed_at", "DESC"]],
  });

  // Get recent activity (last 50)
  const recentActivity = await LearnerActivityLog.findAll({
    where: {
      student_id: parseInt(learnerId),
      course_id: { [Op.in]: courseIds },
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
    order: [["created_at", "DESC"]],
    limit: 50,
    include: [
      {
        model: Courses,
        as: "course",
        attributes: ["id", "title", "course_code"],
        required: false,
      },
    ],
  });

  // Get login history (last 20)
  const loginHistory = await LearnerLoginHistory.findAll({
    where: {
      student_id: parseInt(learnerId),
    },
    order: [["login_at", "DESC"]],
    limit: 20,
  });

  const learnerName = `${learner.fname || ""} ${learner.mname || ""} ${learner.lname || ""}`.trim() || learner.email;

  res.json({
    success: true,
    message: "Learner details retrieved successfully",
    data: {
      learner: {
        id: learner.id,
        name: learnerName,
        email: learner.email,
        matric_number: learner.matric_number,
        phone: learner.phone,
        country: learner.country,
        state_origin: learner.state_origin,
        joined_at: learner.date,
      },
      course_progress: progress.map((p) => ({
        course_id: p.course_id,
        course_title: p.course?.title,
        course_code: p.course?.course_code,
        course_image: p.course?.image_url,
        total_modules: p.total_modules,
        completed_modules: p.completed_modules,
        total_units: p.total_units,
        viewed_units: p.viewed_units,
        completion_percentage: parseFloat(p.completion_percentage || 0),
        is_completed: p.is_completed,
        started_at: p.started_at,
        last_accessed_at: p.last_accessed_at,
        completed_at: p.completed_at,
        time_spent_hours: Math.round((p.total_time_spent_seconds || 0) / 3600 * 100) / 100,
      })),
      recent_activity: recentActivity.map((activity) => ({
        id: activity.id,
        activity_type: activity.activity_type,
        course_id: activity.course_id,
        course_title: activity.course?.title,
        module_id: activity.module_id,
        unit_id: activity.unit_id,
        ip_address: activity.ip_address,
        location_country: activity.location_country,
        location_city: activity.location_city,
        device_type: activity.device_type,
        browser: activity.browser,
        duration_seconds: activity.duration_seconds,
        created_at: activity.created_at,
        metadata: activity.metadata,
      })),
      login_history: loginHistory.map((login) => ({
        id: login.id,
        ip_address: login.ip_address,
        location_country: login.location_country,
        location_city: login.location_city,
        location_region: login.location_region,
        device_type: login.device_type,
        browser: login.browser,
        operating_system: login.operating_system,
        login_at: login.login_at,
        logout_at: login.logout_at,
        session_duration_seconds: login.session_duration_seconds,
        is_active: login.is_active,
      })),
    },
  });
});

/**
 * Get learner activity log
 * GET /api/marketplace/tutor/learners/:learnerId/activity
 */
export const getLearnerActivity = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { learnerId } = req.params;
  const {
    page = 1,
    limit = 50,
    activity_type,
    course_id,
    start_date,
    end_date,
  } = req.query;

  // Verify learner purchased courses from this tutor
  const tutorCourses = await Courses.findAll({
    where: {
      owner_id: tutorId,
      owner_type: tutorType,
      is_marketplace: true,
    },
    attributes: ["id"],
  });

  if (tutorCourses.length === 0) {
    throw new ErrorClass("No courses found for this tutor", 404);
  }

  const courseIds = tutorCourses.map((c) => c.id);

  const enrollment = await CourseReg.findOne({
    where: {
      student_id: parseInt(learnerId),
      course_id: { [Op.in]: courseIds },
      registration_status: "marketplace_purchased",
    },
  });

  if (!enrollment) {
    throw new ErrorClass("Learner not found or has not purchased any courses from you", 404);
  }

  // Build where clause
  const where = {
    student_id: parseInt(learnerId),
    course_id: { [Op.in]: courseIds },
    tutor_id: tutorId,
    tutor_type: tutorType,
  };

  if (activity_type) {
    where.activity_type = activity_type;
  }

  if (course_id) {
    where.course_id = parseInt(course_id);
  }

  if (start_date || end_date) {
    where.created_at = {};
    if (start_date) {
      where.created_at[Op.gte] = new Date(start_date);
    }
    if (end_date) {
      where.created_at[Op.lte] = new Date(end_date);
    }
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: activities } = await LearnerActivityLog.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["created_at", "DESC"]],
    include: [
      {
        model: Courses,
        as: "course",
        attributes: ["id", "title", "course_code"],
        required: false,
      },
    ],
  });

  res.json({
    success: true,
    message: "Learner activity retrieved successfully",
    data: {
      activities: activities.map((activity) => ({
        id: activity.id,
        activity_type: activity.activity_type,
        course_id: activity.course_id,
        course_title: activity.course?.title,
        course_code: activity.course?.course_code,
        module_id: activity.module_id,
        unit_id: activity.unit_id,
        ip_address: activity.ip_address,
        location_country: activity.location_country,
        location_city: activity.location_city,
        device_type: activity.device_type,
        browser: activity.browser,
        duration_seconds: activity.duration_seconds,
        created_at: activity.created_at,
        metadata: activity.metadata,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

/**
 * Get learner course progress
 * GET /api/marketplace/tutor/learners/:learnerId/courses/:courseId/progress
 */
export const getLearnerCourseProgress = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { learnerId, courseId } = req.params;

  // Verify course belongs to tutor
  const course = await Courses.findOne({
    where: {
      id: parseInt(courseId),
      owner_id: tutorId,
      owner_type: tutorType,
      is_marketplace: true,
    },
  });

  if (!course) {
    throw new ErrorClass("Course not found or does not belong to you", 404);
  }

  // Verify learner purchased this course
  const enrollment = await CourseReg.findOne({
    where: {
      student_id: parseInt(learnerId),
      course_id: parseInt(courseId),
      registration_status: "marketplace_purchased",
    },
  });

  if (!enrollment) {
    throw new ErrorClass("Learner has not purchased this course", 404);
  }

  // Get progress
  const progress = await CourseProgress.findOne({
    where: {
      student_id: parseInt(learnerId),
      course_id: parseInt(courseId),
    },
  });

  if (!progress) {
    // Return default progress (not started)
    return res.json({
      success: true,
      message: "Course progress retrieved successfully",
      data: {
        course_id: parseInt(courseId),
        course_title: course.title,
        completion_percentage: 0,
        is_completed: false,
        total_modules: 0,
        completed_modules: 0,
        total_units: 0,
        viewed_units: 0,
        started_at: null,
        last_accessed_at: null,
        completed_at: null,
        time_spent_hours: 0,
      },
    });
  }

  res.json({
    success: true,
    message: "Course progress retrieved successfully",
    data: {
      course_id: progress.course_id,
      course_title: course.title,
      completion_percentage: parseFloat(progress.completion_percentage || 0),
      is_completed: progress.is_completed,
      total_modules: progress.total_modules,
      completed_modules: progress.completed_modules,
      total_units: progress.total_units,
      viewed_units: progress.viewed_units,
      started_at: progress.started_at,
      last_accessed_at: progress.last_accessed_at,
      completed_at: progress.completed_at,
      time_spent_hours: Math.round((progress.total_time_spent_seconds || 0) / 3600 * 100) / 100,
    },
  });
});

