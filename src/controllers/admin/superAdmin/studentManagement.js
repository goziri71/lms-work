import { Op } from "sequelize";
import { Students } from "../../../models/auth/student.js";
import { CourseReg } from "../../../models/course_reg.js";
import { Courses } from "../../../models/course/courses.js";
import { Program } from "../../../models/program/program.js";
import { Faculty } from "../../../models/faculty/faculty.js";
import { Staff } from "../../../models/auth/staff.js";
import { Funding } from "../../../models/payment/funding.js";
import { SchoolFees } from "../../../models/payment/schoolFees.js";
import { CourseOrder } from "../../../models/payment/courseOrder.js";
import { Semester } from "../../../models/auth/semester.js";
import { ExamAttempt, Exam } from "../../../models/exams/index.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";
import { authService } from "../../../service/authservice.js";
import { emailService } from "../../../services/emailService.js";
import { EmailLog } from "../../../models/email/emailLog.js";
import { WspAdmin } from "../../../models/admin/wspAdmin.js";

/**
 * Get all students with pagination and filters
 */
export const getAllStudents = TryCatchFunction(async (req, res) => {
  const { page = 1, limit = 20, status, level, program_id, search } = req.query;

  const where = {};
  if (status) where.admin_status = status;
  if (level) where.level = level;
  if (program_id) where.program_id = program_id;
  if (search) {
    where[Op.or] = [
      { fname: { [Op.iLike]: `%${search}%` } },
      { lname: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { matric_number: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows: students } = await Students.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    attributes: { exclude: ["password", "token"] },
    include: [
      {
        model: Program,
        as: "program",
        attributes: ["id", "title"],
      },
    ],
    order: [["id", "DESC"]], // Order by ID (newest first)
  });

  res.status(200).json({
    success: true,
    message: "Students retrieved successfully",
    data: {
      students,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    },
  });
});

/**
 * Get single student by ID (Basic)
 */
export const getStudentById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const student = await Students.findByPk(id, {
    attributes: { exclude: ["password"] },
    include: [
      {
        model: Program,
        as: "program",
      },
      {
        model: CourseReg,
        as: "courseRegistrations",
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

  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Student retrieved successfully",
    data: {
      student,
    },
  });
});

/**
 * Get comprehensive student details (Full Profile)
 * Includes: Personal Info, Faculty, Program, Courses, Exams, Results, Wallet, Payments
 */
export const getStudentFullDetails = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  // Get student with program and faculty
  const student = await Students.findByPk(id, {
    attributes: { exclude: ["password", "token"] },
    include: [
      {
        model: Program,
        as: "program",
        include: [
          {
            model: Faculty,
            as: "faculty",
            attributes: ["id", "name", "description"],
          },
        ],
      },
    ],
  });

  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get current semester
  const currentDate = new Date();
  const today = currentDate.toISOString().split("T")[0];
  let currentSemester = await Semester.findOne({
    where: {
      [Op.and]: [
        Semester.sequelize.literal(`DATE(start_date) <= '${today}'`),
        Semester.sequelize.literal(`DATE(end_date) >= '${today}'`),
      ],
    },
    order: [["id", "DESC"]],
  });

  if (!currentSemester) {
    currentSemester = await Semester.findOne({
      where: Semester.sequelize.where(
        Semester.sequelize.fn("UPPER", Semester.sequelize.col("status")),
        "ACTIVE"
      ),
      order: [["id", "DESC"]],
    });
  }

  // Get all course registrations with full course details
  // Order by course_order (course_reg.course_reg_id links to course_order.id)
  // This groups courses registered together in the same order and maintains the order sequence
  const courseRegistrations = await CourseReg.findAll({
    where: { student_id: id },
    include: [
      {
        model: Courses,
        as: "course",
        include: [
          {
            model: Program,
            as: "program",
            attributes: ["id", "title"],
          },
          {
            model: Faculty,
            as: "faculty",
            attributes: ["id", "name"],
          },
          {
            model: Staff,
            as: "instructor",
            attributes: ["id", "full_name", "email"],
          },
        ],
      },
      {
        model: CourseOrder,
        as: "courseOrder",
        attributes: ["id", "date", "amount", "currency"],
        required: false, // LEFT JOIN - course_reg may not have course_order
      },
    ],
    // Order by course_order date (if exists), then by course_reg_id to group courses in same order
    // Then by academic_year, semester, and registration id
    // Cast course_reg.date (VARCHAR) to timestamp to match courseOrder.date (timestamp) for proper date ordering
    order: [
      [
        CourseReg.sequelize.literal(
          `COALESCE("courseOrder"."date", course_reg.date::timestamp)`
        ),
        "DESC",
      ],
      [
        CourseReg.sequelize.literal(`COALESCE(course_reg.course_reg_id, 0)`),
        "DESC",
      ],
      ["academic_year", "DESC"],
      ["semester", "DESC"],
      ["id", "ASC"], // Within same order, order by registration id
    ],
  });

  // Get exam attempts for student (Exam is in Library DB, so we'll get course info separately)
  const examAttempts = await ExamAttempt.findAll({
    where: { student_id: id },
    include: [
      {
        model: Exam,
        as: "exam",
        attributes: [
          "id",
          "title",
          "course_id",
          "exam_type",
          "duration_minutes",
          "academic_year",
          "semester",
        ],
      },
    ],
    order: [["started_at", "DESC"]],
  });

  // Get course details for exams (since Exam is in Library DB, we need to fetch courses separately)
  const examCourseIds = [
    ...new Set(examAttempts.map((a) => a.exam?.course_id).filter(Boolean)),
  ];
  const examCourses =
    examCourseIds.length > 0
      ? await Courses.findAll({
          where: { id: { [Op.in]: examCourseIds } },
          attributes: ["id", "title", "course_code"],
        })
      : [];

  const courseMap = new Map(examCourses.map((c) => [c.id, c]));

  // Get wallet funding transactions
  const fundingTransactions = await Funding.findAll({
    where: { student_id: id },
    order: [["date", "DESC"]],
    limit: 50, // Last 50 transactions
  });

  // Calculate wallet summary
  const totalCredits = await Funding.sum("amount", {
    where: { student_id: id, type: "Credit" },
  });
  const totalDebits = await Funding.sum("amount", {
    where: { student_id: id, type: "Debit" },
  });
  const walletBalance = (totalCredits || 0) - (totalDebits || 0);

  // Get school fees history
  const schoolFeesHistory = await SchoolFees.findAll({
    where: { student_id: id },
    order: [["date", "DESC"]],
  });

  // Check current semester school fees status
  let currentSemesterSchoolFees = null;
  if (currentSemester) {
    currentSemesterSchoolFees = await SchoolFees.findOne({
      where: {
        student_id: id,
        academic_year: currentSemester.academic_year?.toString() || null,
        semester: currentSemester.semester?.toString() || null,
      },
      order: [["id", "DESC"]],
    });
  }

  // Get course orders
  const courseOrders = await CourseOrder.findAll({
    where: { student_id: id },
    order: [["date", "DESC"]],
    limit: 50,
  });

  // Group course registrations by semester/academic year for Registrations section
  const registrationsBySemester = {};
  courseRegistrations.forEach((reg) => {
    const key = `${reg.academic_year || "Unknown"}_${
      reg.semester || "Unknown"
    }`;
    if (!registrationsBySemester[key]) {
      registrationsBySemester[key] = {
        academic_year: reg.academic_year,
        semester: reg.semester,
        course_count: 0,
        courses: [],
        registration_date: reg.date,
        school_fees: null,
        registration_status: "pending", // Will be updated based on school fees
      };
    }
    registrationsBySemester[key].course_count++;
    registrationsBySemester[key].courses.push({
      id: reg.course?.id,
      title: reg.course?.title,
      course_code: reg.course?.course_code,
      registration_id: reg.id,
      registration_date: reg.date,
    });
  });

  // Match school fees with registrations to determine registration status
  schoolFeesHistory.forEach((fee) => {
    const key = `${fee.academic_year || "Unknown"}_${
      fee.semester || "Unknown"
    }`;
    if (registrationsBySemester[key]) {
      registrationsBySemester[key].school_fees = {
        id: fee.id,
        amount: fee.amount,
        status: fee.status,
        date: fee.date,
        type: fee.type,
        teller_no: fee.teller_no,
        currency: fee.currency,
      };
      // Update registration status based on school fees
      if (fee.status === "Paid") {
        registrationsBySemester[key].registration_status = "registered";
      } else if (fee.amount > 0) {
        registrationsBySemester[key].registration_status = "pending_payment";
      }
    } else {
      // School fees without course registrations (semester registration only)
      registrationsBySemester[key] = {
        academic_year: fee.academic_year,
        semester: fee.semester,
        course_count: 0,
        courses: [],
        registration_date: fee.date,
        school_fees: {
          id: fee.id,
          amount: fee.amount,
          status: fee.status,
          date: fee.date,
          type: fee.type,
          teller_no: fee.teller_no,
          currency: fee.currency,
        },
        registration_status:
          fee.status === "Paid" ? "registered" : "pending_payment",
      };
    }
  });

  // Convert to array and sort by academic year and semester (newest first)
  const registrations = Object.values(registrationsBySemester).sort((a, b) => {
    // Sort by academic year (descending), then by semester
    if (a.academic_year !== b.academic_year) {
      return (b.academic_year || "").localeCompare(a.academic_year || "");
    }
    // Sort semester: 2ND before 1ST, or by semester number
    const semesterOrder = { "2ND": 2, 2: 2, "1ST": 1, 1: 1 };
    return (semesterOrder[b.semester] || 0) - (semesterOrder[a.semester] || 0);
  });

  // Group course registrations by academic_year, semester, and date
  const coursesBySemester = {};

  courseRegistrations.forEach((reg) => {
    const academicYear = reg.academic_year || "Unknown";
    const semester = reg.semester || "Unknown";
    const key = `${academicYear}_${semester}`;

    if (!coursesBySemester[key]) {
      // Use course_order date if available, otherwise use registration date
      // For the group date, use the earliest date in that semester
      const regDate = reg.courseOrder?.date
        ? new Date(reg.courseOrder.date).toISOString().split("T")[0]
        : reg.date || new Date().toISOString().split("T")[0];

      coursesBySemester[key] = {
        academic_year: academicYear,
        semester: semester,
        date: regDate, // Will be updated to earliest date
        courses: [],
      };
    }

    // Update date to earliest registration date in this semester
    const regDate = reg.courseOrder?.date
      ? new Date(reg.courseOrder.date).toISOString().split("T")[0]
      : reg.date || new Date().toISOString().split("T")[0];

    if (regDate < coursesBySemester[key].date) {
      coursesBySemester[key].date = regDate;
    }

    // Add course with full details
    coursesBySemester[key].courses.push({
      id: reg.course?.id,
      title: reg.course?.title,
      course_code: reg.course?.course_code,
      course_unit: reg.course?.course_unit,
      course_type: reg.course?.course_type,
      course_level: reg.course?.course_level,
      price: reg.course?.price,
      exam_fee: reg.course?.exam_fee,
      currency: reg.course?.currency,
      program: reg.course?.program,
      faculty: reg.course?.faculty,
      instructor: reg.course?.instructor,
      registration: {
        id: reg.id,
        level: reg.level,
        date: reg.date,
        ref: reg.ref,
        course_reg_id: reg.course_reg_id,
      },
      results: {
        first_ca: reg.first_ca,
        second_ca: reg.second_ca,
        third_ca: reg.third_ca,
        exam_score: reg.exam_score,
        total_score:
          reg.first_ca + reg.second_ca + reg.third_ca + reg.exam_score,
      },
    });
  });

  // Sort courses within each semester by course_code
  Object.values(coursesBySemester).forEach((group) => {
    group.courses.sort((a, b) => {
      const codeA = a.course_code || "";
      const codeB = b.course_code || "";
      return codeA.localeCompare(codeB);
    });
  });

  // Convert to array and sort by academic year (newest first), then semester (2ND before 1ST)
  const courses = Object.values(coursesBySemester).sort((a, b) => {
    // Sort by academic year (descending - newest first)
    if (a.academic_year !== b.academic_year) {
      return (b.academic_year || "").localeCompare(a.academic_year || "");
    }
    // Sort semester: 2ND before 1ST
    const semesterOrder = { "2ND": 2, 2: 2, "1ST": 1, 1: 1 };
    return (semesterOrder[b.semester] || 0) - (semesterOrder[a.semester] || 0);
  });

  // Format exam attempts with course info
  const exams = examAttempts.map((attempt) => {
    const course = attempt.exam?.course_id
      ? courseMap.get(attempt.exam.course_id)
      : null;
    return {
      id: attempt.id,
      exam_id: attempt.exam_id,
      attempt_no: attempt.attempt_no,
      status: attempt.status,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      graded_at: attempt.graded_at,
      total_score: attempt.total_score,
      max_score: attempt.max_score,
      exam: attempt.exam
        ? {
            ...attempt.exam.toJSON(),
            course: course || null,
          }
        : null,
    };
  });

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "viewed_student_full_details",
        "student",
        id,
        {
          student_name: `${student.fname} ${student.lname}`,
          student_email: student.email,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Student full details retrieved successfully",
    data: {
      personalInformation: {
        id: student.id,
        fname: student.fname,
        mname: student.mname,
        lname: student.lname,
        email: student.email,
        phone: student.phone,
        gender: student.gender,
        dob: student.dob,
        address: student.address,
        state_origin: student.state_origin,
        lcda: student.lcda,
        country: student.country,
        matric_number: student.matric_number,
        level: student.level,
        admin_status: student.admin_status,
        g_status: student.g_status,
        study_mode: student.study_mode,
        application_code: student.application_code,
        referral_code: student.referral_code,
        date: student.date,
      },
      faculty: student.program?.faculty || null,
      program: student.program
        ? {
            id: student.program.id,
            title: student.program.title,
            description: student.program.description,
            status: student.program.status,
          }
        : null,
      registrations: registrations,
      courses: courses,
      exams: exams,
      wallet: {
        balance: student.wallet_balance || walletBalance,
        currency: student.currency || "NGN",
        transactions: fundingTransactions,
        summary: {
          total_credits: totalCredits || 0,
          total_debits: totalDebits || 0,
          net_balance: walletBalance,
        },
      },
      payments: {
        schoolFees: {
          history: schoolFeesHistory,
          currentSemester: currentSemesterSchoolFees
            ? {
                id: currentSemesterSchoolFees.id,
                amount: currentSemesterSchoolFees.amount,
                status: currentSemesterSchoolFees.status,
                academic_year: currentSemesterSchoolFees.academic_year,
                semester: currentSemesterSchoolFees.semester,
                date: currentSemesterSchoolFees.date,
                type: currentSemesterSchoolFees.type,
                paid: currentSemesterSchoolFees.status === "Paid",
              }
            : null,
        },
        courseOrders: courseOrders,
      },
      currentSemester: currentSemester
        ? {
            id: currentSemester.id,
            academic_year: currentSemester.academic_year,
            semester: currentSemester.semester,
            status: currentSemester.status,
            start_date: currentSemester.start_date,
            end_date: currentSemester.end_date,
          }
        : null,
    },
  });
});

/**
 * Create new student
 */
export const createStudent = TryCatchFunction(async (req, res) => {
  const {
    email,
    password,
    fname,
    lname,
    mname,
    gender,
    phone,
    program_id,
    level,
    ...otherData
  } = req.body;

  // Validate required fields
  if (!email || !password || !fname || !lname) {
    throw new ErrorClass(
      "Email, password, first name, and last name are required",
      400
    );
  }

  // Check if email already exists
  const existingStudent = await Students.findOne({
    where: { email: email.toLowerCase() },
  });

  if (existingStudent) {
    throw new ErrorClass("Email already exists", 409);
  }

  // Hash password
  const hashedPassword = authService.hashPassword(password);

  // Create student with required defaults
  const student = await Students.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    fname,
    lname,
    mname,
    gender,
    phone,
    program_id,
    level,
    admin_status: "active",
    date: new Date(),
    // Required fields with defaults
    currency: otherData.currency || "NGN",
    referral_code: otherData.referral_code || "",
    designated_institute: otherData.designated_institute || 0,
    foreign_student: otherData.foreign_student || 0,
    ...otherData,
  });

  // Log activity
  await logAdminActivity(
    req.user.id,
    "created_student",
    "student",
    student.id,
    `Created student: ${fname} ${lname} (${email})`,
    { student_id: student.id, email }
  );

  res.status(201).json({
    success: true,
    message: "Student created successfully",
    data: {
      student: {
        id: student.id,
        firstName: student.fname,
        lastName: student.lname,
        email: student.email,
        matricNumber: student.matric_number,
        status: student.admin_status,
      },
    },
  });
});

/**
 * Update student
 */
export const updateStudent = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Remove sensitive fields
  delete updateData.password;

  const student = await Students.findByPk(id);

  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  const oldData = { ...student.dataValues };
  await student.update(updateData);

  // Log activity
  await logAdminActivity(
    req.user.id,
    "updated_student",
    "student",
    id,
    `Updated student: ${student.fname} ${student.lname}`,
    {
      student_id: id,
      changes: {
        before: oldData,
        after: student.dataValues,
      },
    }
  );

  res.status(200).json({
    success: true,
    message: "Student updated successfully",
    data: {
      student: {
        id: student.id,
        firstName: student.fname,
        lastName: student.lname,
        email: student.email,
        status: student.admin_status,
      },
    },
  });
});

/**
 * Deactivate student (soft delete)
 */
export const deactivateStudent = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const student = await Students.findByPk(id);

  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  await student.update({ admin_status: "inactive" });

  // Log activity
  await logAdminActivity(
    req.user.id,
    "deactivated_student",
    "student",
    id,
    `Deactivated student: ${student.fname} ${student.lname}`,
    { student_id: id, reason: reason || "No reason provided" }
  );

  res.status(200).json({
    success: true,
    message: "Student deactivated successfully",
  });
});

/**
 * Activate student
 */
export const activateStudent = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const student = await Students.findByPk(id);

  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  await student.update({ admin_status: "active" });

  // Log activity
  await logAdminActivity(
    req.user.id,
    "activated_student",
    "student",
    id,
    `Activated student: ${student.fname} ${student.lname}`,
    { student_id: id }
  );

  res.status(200).json({
    success: true,
    message: "Student activated successfully",
  });
});

/**
 * Reset student password
 */
export const resetStudentPassword = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    throw new ErrorClass("New password is required", 400);
  }

  const student = await Students.findByPk(id);

  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  const hashedPassword = authService.hashPassword(newPassword);
  await student.update({ password: hashedPassword });

  // Get admin name for email
  const admin = await WspAdmin.findByPk(req.user.id);
  const adminName = admin ? `${admin.fname} ${admin.lname}` : "Administrator";

  // Send password changed notification email
  try {
    await emailService.sendPasswordChangedEmail(student, {
      userType: "student",
      ipAddress: req.ip || req.connection.remoteAddress,
      device: req.get("user-agent") || "Unknown",
      changedBy: adminName,
    });

    // Log email sent
    await EmailLog.create({
      recipient_email: student.email,
      recipient_type: "student",
      recipient_id: student.id,
      email_type: "password_changed",
      subject: "Your Password Has Been Changed",
      status: "sent",
    });
  } catch (emailError) {
    console.error("Error sending password changed email:", emailError);
    // Don't throw error - password was reset successfully
  }

  // Log activity
  await logAdminActivity(
    req.user.id,
    "reset_student_password",
    "student",
    id,
    `Reset password for student: ${student.fname} ${student.lname}`,
    { student_id: id }
  );

  res.status(200).json({
    success: true,
    message: "Student password reset successfully. Notification email sent.",
  });
});

/**
 * Get student statistics
 */
export const getStudentStats = TryCatchFunction(async (req, res) => {
  const totalStudents = await Students.count();
  const activeStudents = await Students.count({
    where: { admin_status: "active" },
  });
  const inactiveStudents = await Students.count({
    where: { admin_status: "inactive" },
  });

  // Students by level
  const studentsByLevel = await Students.findAll({
    attributes: [
      "level",
      [Students.sequelize.fn("COUNT", Students.sequelize.col("id")), "count"],
    ],
    group: ["level"],
    raw: true,
  });

  // Students by program
  const studentsByProgram = await Students.findAll({
    attributes: [
      "program_id",
      [
        Students.sequelize.fn("COUNT", Students.sequelize.col("Student.id")),
        "count",
      ],
    ],
    include: [
      {
        model: Program,
        as: "program",
        attributes: ["title"],
      },
    ],
    group: ["program_id", "program.id"],
    raw: true,
  });

  res.status(200).json({
    success: true,
    message: "Student statistics retrieved successfully",
    data: {
      total: totalStudents,
      active: activeStudents,
      inactive: inactiveStudents,
      byLevel: studentsByLevel,
      byProgram: studentsByProgram,
    },
  });
});
