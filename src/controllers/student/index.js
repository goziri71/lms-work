import { Students } from "../../models/auth/student.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Op } from "sequelize";

export const getAllStudents = TryCatchFunction(async (req, res) => {
  const userType = req.user?.userType;
  const staffId = Number(req.user?.id);

  // // Only staff can view all students
  // if (userType !== "staff") {
  //   throw new ErrorClass("Only staff can view all students", 403);
  // }

  // Query parameters
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 100); // Max 100 per page
  const search = (req.query.search || "").toLowerCase();
  const sort = req.query.sort || "date"; // 'date', 'name', 'email', 'level'
  const status = req.query.status; // Filter by admin_status
  const level = req.query.level; // Filter by level
  const courseIdFilter = Number(req.query.course_id);

  // Build where clause
  const whereClause = {};

  if (search) {
    whereClause[Op.or] = [
      { fname: { [Op.iLike]: `%${search}%` } },
      { lname: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { matric_number: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (status) {
    whereClause.admin_status = status;
  }

  if (level) {
    whereClause.level = level;
  }

  // Build order clause
  let orderClause;
  switch (sort) {
    case "name":
      orderClause = [
        ["fname", "ASC"],
        ["lname", "ASC"],
      ];
      break;
    case "email":
      orderClause = [["email", "ASC"]];
      break;
    case "level":
      orderClause = [["level", "ASC"]];
      break;
    case "date":
    default:
      orderClause = [["date", "DESC"]];
      break;
  }

  // Determine allowed course ids for this staff
  const staffCourses = await Courses.findAll({
    where: { staff_id: staffId },
    attributes: ["id"],
  });
  const allowedCourseIds = staffCourses.map((c) => c.id);

  // If a specific course_id is provided, restrict to it (and implicitly to staff's courses)
  let targetCourseIds = allowedCourseIds;
  if (Number.isInteger(courseIdFilter) && courseIdFilter > 0) {
    if (allowedCourseIds.includes(courseIdFilter)) {
      targetCourseIds = [courseIdFilter];
    } else {
      // If staff doesn't own this course, return empty list
      return res.status(200).json({
        status: true,
        code: 200,
        message: "Students retrieved successfully",
        data: {
          students: [],
          pagination: {
            current_page: page,
            per_page: limit,
            total: 0,
            total_pages: 0,
            has_next_page: false,
            has_prev_page: false,
          },
          filters: {
            search: search || null,
            sort,
            status: status || null,
            level: level || null,
            course_id: courseIdFilter,
          },
        },
      });
    }
  }

  // Get distinct student ids enrolled in these course(s)
  let studentIdWhere = {};
  if (targetCourseIds.length > 0) {
    const regs = await CourseReg.findAll({
      where: { course_id: { [Op.in]: targetCourseIds } },
      attributes: ["student_id"],
    });
    const studentIds = Array.from(new Set(regs.map((r) => r.student_id)));
    // If no students, return early
    if (studentIds.length === 0) {
      return res.status(200).json({
        status: true,
        code: 200,
        message: "Students retrieved successfully",
        data: {
          students: [],
          pagination: {
            current_page: page,
            per_page: limit,
            total: 0,
            total_pages: 0,
            has_next_page: false,
            has_prev_page: false,
          },
          filters: {
            search: search || null,
            sort,
            status: status || null,
            level: level || null,
            course_id: Number.isInteger(courseIdFilter) ? courseIdFilter : null,
          },
        },
      });
    }
    studentIdWhere = { id: { [Op.in]: studentIds } };
  }

  const combinedWhere = { ...whereClause, ...studentIdWhere };

  // Get total count for pagination (restricted set)
  const totalCount = await Students.count({ where: combinedWhere });

  // Get students with pagination
  const students = await Students.findAll({
    where: combinedWhere,
    order: orderClause,
    limit: limit,
    offset: (page - 1) * limit,
    attributes: [
      "id",
      "fname",
      "mname",
      "lname",
      "email",
      "phone",
      "matric_number",
      "level",
      "admin_status",
      "g_status",
      "a_status",
      "gender",
      "dob",
      "address",
      "state_origin",
      "country",
      "program_id",
      "facaulty_id",
      "study_mode",
      "wallet_balance",
      "currency",
      "date",
      "application_code",
      "referral_code",
      "designated_institute",
      "foreign_student",
    ],
  });

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  res.status(200).json({
    status: true,
    code: 200,
    message: "Students retrieved successfully",
    data: {
      students,
      pagination: {
        current_page: page,
        per_page: limit,
        total: totalCount,
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage,
      },
      filters: {
        search: search || null,
        sort,
        status: status || null,
        level: level || null,
        course_id: Number.isInteger(courseIdFilter) ? courseIdFilter : null,
      },
    },
  });
});

export const getStudentById = TryCatchFunction(async (req, res) => {
  const userType = req.user?.userType;
  const studentId = Number(req.params.id);

  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new ErrorClass("Invalid student ID", 400);
  }

  // Only staff can view individual student details
  if (userType !== "staff") {
    throw new ErrorClass("Only staff can view student details", 403);
  }

  const student = await Students.findByPk(studentId, {
    attributes: [
      "id",
      "fname",
      "mname",
      "lname",
      "email",
      "phone",
      "matric_number",
      "level",
      "admin_status",
      "g_status",
      "a_status",
      "gender",
      "dob",
      "address",
      "state_origin",
      "lcda",
      "country",
      "program_id",
      "facaulty_id",
      "study_mode",
      "wallet_balance",
      "currency",
      "date",
      "application_code",
      "referral_code",
      "designated_institute",
      "foreign_student",
      "teller_no",
      "account_no",
      "account_name",
      "bank",
    ],
  });

  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Student retrieved successfully",
    data: { student },
  });
});
