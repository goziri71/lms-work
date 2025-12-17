import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { Staff } from "../../models/auth/staff.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { Op } from "sequelize";
import { checkCourseFeesPayment } from "../../services/paymentVerificationService.js";

export const getStudentCourses = TryCatchFunction(async (req, res) => {
  // Accept either /student/:startYear/:endYear/:semester or query params
  const academicYear =
    req.query.academicYear ||
    (req.params.startYear && req.params.endYear
      ? `${req.params.startYear}/${req.params.endYear}`
      : req.params.academicYear);
  const semester = req.query.semester || req.params.semester;
  const parsedStudentId = Number(req.user?.id);
  if (!Number.isInteger(parsedStudentId) || parsedStudentId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }

  const student = await Students.findByPk(parsedStudentId, {
    attributes: ["id"],
  });
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  const includeCourses = {
    model: Courses,
    as: "courses",
    include: [
      {
        model: Staff,
        as: "instructor",
        attributes: ["id", "full_name", "email", "phone"],
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
    ],
    through: {
      as: "registration",
      attributes: [
        "id",
        "academic_year",
        "semester",
        "level",
        "first_ca",
        "second_ca",
        "third_ca",
        "exam_score",
        "date",
        "ref",
        "registration_status",
        "course_reg_id",
      ],
      where: {
        // Exclude marketplace purchases (lifetime access, not semester-based)
        registration_status: { [Op.ne]: "marketplace_purchased" },
        // Filter by academic year and semester if provided
        ...(academicYear || semester
          ? {
              ...(academicYear ? { academic_year: academicYear } : {}),
              ...(semester ? { semester } : {}),
            }
          : {
              // If no filter, only show courses with academic_year and semester (program courses)
              academic_year: { [Op.ne]: null },
              semester: { [Op.ne]: null },
            }),
      },
    },
  };

  const studentWithCourses = await Students.findByPk(parsedStudentId, {
    include: [includeCourses],
    attributes: [
      "id",
      "fname",
      "mname",
      "lname",
      "email",
      "matric_number",
      "level",
    ],
  });
  const data = studentWithCourses?.courses;
  console.log(data);
  if (!data) {
    throw new ErrorClass("No courses found", 404);
  }

  // Add paid boolean to each course
  const coursesWithPaidStatus = await Promise.all(
    data.map(async (course) => {
      const courseData = course.toJSON();
      const registration = courseData.registration;

      // Determine if course is paid
      let paid = false;

      if (registration) {
        const regAcademicYear = registration.academic_year;
        const regSemester = registration.semester;

        // Check payment status using the payment verification service
        const paymentStatus = await checkCourseFeesPayment(
          parsedStudentId,
          courseData.id,
          regAcademicYear,
          regSemester
        );

        paid = paymentStatus.paid;
      }

      // Add paid field to course data
      courseData.paid = paid;

      return courseData;
    })
  );

  res.status(200).json({
    status: true,
    code: 200,
    message: "Courses fetched successfully",
    data: coursesWithPaidStatus,
  });
});

export const getStaffCourses = TryCatchFunction(async (req, res) => {
  const academicYear =
    req.query.academicYear ||
    (req.params.startYear && req.params.endYear
      ? `${req.params.startYear}/${req.params.endYear}`
      : req.params.academicYear);
  const { semester, includeStudents } = req.query;
  const parsedStaffId = Number(req.user?.id);
  if (!Number.isInteger(parsedStaffId) || parsedStaffId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }

  const staff = await Staff.findByPk(parsedStaffId, { attributes: ["id"] });
  if (!staff) {
    throw new ErrorClass("Staff not found", 404);
  }

  const courseWhere = {
    staff_id: parsedStaffId,
    ...(semester ? { semester } : {}),
  };

  const include = [];
  if (String(includeStudents).toLowerCase() === "true") {
    include.push({
      model: Students,
      as: "students",
      attributes: [
        "id",
        "fname",
        "mname",
        "lname",
        "email",
        "matric_number",
        "level",
        "program_id",
        "facaulty_id",
      ],
      through: {
        as: "registration",
        attributes: [
          "id",
          "academic_year",
          "semester",
          "level",
          "first_ca",
          "second_ca",
          "third_ca",
          "exam_score",
        ],
        where: academicYear ? { academic_year: academicYear } : undefined,
      },
      required: false,
    });
  }

  const data = await Courses.findAll({
    where: courseWhere,
    include,
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
      "staff_id",
    ],
    order: [["id", "ASC"]],
  });
  res.status(200).json({
    status: true,
    code: 200,
    message: "Courses fetched successfully",
    data: data,
  });
});

// Get a single course by id for staff (owner) or student (enrolled)
export const getCourseById = TryCatchFunction(async (req, res) => {
  const courseId = Number(req.params.courseId || req.query.courseId);
  if (!Number.isInteger(courseId) || courseId <= 0) {
    throw new ErrorClass("Invalid course id", 400);
  }

  const userId = Number(req.user?.id);
  let userType = req.user?.userType;
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }

  // Backward compatibility: infer userType if missing in older tokens
  if (!userType) {
    const staff = await Staff.findByPk(userId, { attributes: ["id"] });
    if (staff) {
      userType = "staff";
    } else {
      const student = await Students.findByPk(userId, { attributes: ["id"] });
      if (student) userType = "student";
    }
  }

  let where = { id: courseId };
  let include = [
    {
      model: Staff,
      as: "instructor",
      attributes: ["id", "full_name", "email", "phone"],
      required: false,
    },
  ];

  // Admins can access any course (no restrictions)
  if (userType === "admin" || userType === "super_admin") {
    // No additional where clause needed - admins can see all courses
  } else if (userType === "staff") {
    where = { ...where, staff_id: userId };
  } else if (userType === "student") {
    include.push({
      model: Students,
      as: "students",
      attributes: [],
      through: { attributes: [] },
      where: { id: userId },
      required: true,
    });
  } else {
    throw new ErrorClass("Unauthorized", 401);
  }

  const course = await Courses.findOne({
    where,
    include,
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
      "staff_id",
    ],
  });

  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Course fetched successfully",
    data: course,
  });
});

// Participants (student-accessible): lecturer + enrolled classmates for a course
export const getCourseParticipants = TryCatchFunction(async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!Number.isInteger(courseId) || courseId <= 0) {
    throw new ErrorClass("Invalid course id", 400);
  }

  const requesterId = Number(req.user?.id);
  const requesterType = req.user?.userType;
  if (!Number.isInteger(requesterId) || requesterId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (requesterType !== "student") {
    throw new ErrorClass("Only students can access participants", 403);
  }

  const academicYear = req.query.academic_year || req.query.academicYear;
  const semester = req.query.semester;
  const search = (req.query.search || "").trim();
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const includeSelf =
    String(req.query.includeSelf || "false").toLowerCase() === "true";

  // Verify course exists
  const course = await Courses.findByPk(courseId, {
    attributes: ["id", "title", "course_code", "staff_id"],
  });
  if (!course) throw new ErrorClass("Course not found", 404);

  // Verify requester is enrolled in this course (and session filters if provided)
  const enrollmentWhere = {
    course_id: courseId,
    student_id: requesterId,
    ...(academicYear ? { academic_year: academicYear } : {}),
    ...(semester ? { semester } : {}),
  };
  const enrollment = await CourseReg.findOne({ where: enrollmentWhere });
  if (!enrollment) {
    throw new ErrorClass("Not enrolled in this course", 403);
  }

  // Lecturer info
  const lecturer = await Staff.findByPk(course.staff_id, {
    attributes: ["id", "full_name", "email", "phone"],
  });

  // Get classmates student ids for the same course (+optional session filters)
  const regWhere = {
    course_id: courseId,
    ...(academicYear ? { academic_year: academicYear } : {}),
    ...(semester ? { semester } : {}),
  };
  const regs = await CourseReg.findAll({
    where: regWhere,
    attributes: ["student_id"],
  });
  let studentIds = Array.from(new Set(regs.map((r) => r.student_id)));
  if (!includeSelf) {
    studentIds = studentIds.filter((id) => id !== requesterId);
  }

  // Build search where for students
  const studentWhere = { id: { [Op.in]: studentIds } };
  if (search) {
    const like = { [Op.iLike]: `%${search}%` };
    studentWhere[Op.or] = [
      { fname: like },
      { lname: like },
      { email: like },
      { matric_number: like },
      { phone: like },
    ];
  }

  const total = studentIds.length
    ? await Students.count({ where: studentWhere })
    : 0;
  const classmates = total
    ? await Students.findAll({
        where: studentWhere,
        attributes: [
          "id",
          "fname",
          "mname",
          "lname",
          "email",
          "matric_number",
          "level",
          "program_id",
          "facaulty_id",
        ],
        order: [
          ["fname", "ASC"],
          ["lname", "ASC"],
        ],
        limit,
        offset: (page - 1) * limit,
      })
    : [];

  const totalPages = Math.ceil(total / limit) || 0;

  res.status(200).json({
    status: true,
    code: 200,
    message: "Participants fetched successfully",
    data: {
      course: {
        id: course.id,
        title: course.title,
        course_code: course.course_code,
      },
      lecturer: lecturer
        ? {
            id: lecturer.id,
            full_name: lecturer.full_name,
            email: lecturer.email,
            phone: lecturer.phone,
          }
        : null,
      classmates,
      pagination: {
        current_page: page,
        per_page: limit,
        total,
        total_pages: totalPages,
        has_next_page: page < totalPages,
        has_prev_page: page > 1,
      },
      filters: {
        academic_year: academicYear || null,
        semester: semester || null,
        search: search || null,
        includeSelf,
      },
    },
  });
});

// Student-self participants across all their enrolled courses (no courseId needed)
// GET /api/courses/participants?academic_year=2024/2025&semester=2ND&includeSelf=false
export const getMyCourseParticipants = TryCatchFunction(async (req, res) => {
  const requesterId = Number(req.user?.id);
  const requesterType = req.user?.userType;
  if (!Number.isInteger(requesterId) || requesterId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (requesterType !== "student") {
    throw new ErrorClass("Only students can access participants", 403);
  }

  const academicYear = req.query.academic_year || req.query.academicYear;
  const semester = req.query.semester;
  const search = (req.query.search || "").trim();
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const includeSelf =
    String(req.query.includeSelf || "false").toLowerCase() === "true";

  // Find the student's course registrations (with optional session filters)
  const regWhere = {
    student_id: requesterId,
    ...(academicYear ? { academic_year: academicYear } : {}),
    ...(semester ? { semester } : {}),
  };
  const myRegs = await CourseReg.findAll({
    where: regWhere,
    attributes: ["course_id"],
  });
  const courseIds = Array.from(new Set(myRegs.map((r) => r.course_id)));

  if (courseIds.length === 0) {
    return res.status(200).json({
      status: true,
      code: 200,
      message: "Participants fetched successfully",
      data: {
        courses: [],
        filters: {
          academic_year: academicYear || null,
          semester: semester || null,
          search: search || null,
          includeSelf,
        },
      },
    });
  }

  // Fetch course + lecturer for each
  const courses = await Courses.findAll({
    where: { id: { [Op.in]: courseIds } },
    attributes: ["id", "title", "course_code", "staff_id"],
  });

  // For each course, fetch classmates and lecturer
  const result = [];
  for (const course of courses) {
    // classmates ids for that course (respecting optional session filters)
    const clsRegs = await CourseReg.findAll({
      where: {
        course_id: course.id,
        ...(academicYear ? { academic_year: academicYear } : {}),
        ...(semester ? { semester } : {}),
      },
      attributes: ["student_id"],
    });
    let studentIds = Array.from(new Set(clsRegs.map((r) => r.student_id)));
    if (!includeSelf)
      studentIds = studentIds.filter((id) => id !== requesterId);

    const studentsWhere = studentIds.length
      ? { id: { [Op.in]: studentIds } }
      : { id: { [Op.in]: [-1] } };
    if (search) {
      const like = { [Op.iLike]: `%${search}%` };
      studentsWhere[Op.or] = [
        { fname: like },
        { lname: like },
        { email: like },
        { matric_number: like },
        { phone: like },
      ];
    }

    const classmates = await Students.findAll({
      where: studentsWhere,
      attributes: [
        "id",
        "fname",
        "mname",
        "lname",
        "email",
        "matric_number",
        "level",
        "program_id",
        "facaulty_id",
      ],
      order: [
        ["fname", "ASC"],
        ["lname", "ASC"],
      ],
      limit,
      offset: (page - 1) * limit,
    });

    const lecturer = course.staff_id
      ? await Staff.findByPk(course.staff_id, {
          attributes: ["id", "full_name", "email", "phone"],
        })
      : null;

    result.push({
      course: {
        id: course.id,
        title: course.title,
        course_code: course.course_code,
      },
      lecturer: lecturer
        ? {
            id: lecturer.id,
            full_name: lecturer.full_name,
            email: lecturer.email,
            phone: lecturer.phone,
          }
        : null,
      classmates,
    });
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Participants fetched successfully",
    data: {
      courses: result,
      pagination: { current_page: page, per_page: limit },
      filters: {
        academic_year: academicYear || null,
        semester: semester || null,
        search: search || null,
        includeSelf,
      },
    },
  });
});
