import { Students } from "../../../models/auth/student.js";
import { CourseReg } from "../../../models/course_reg.js";
import { Courses } from "../../../models/course/courses.js";
import { Program } from "../../../models/program/program.js";
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
    where[Students.sequelize.Op.or] = [
      { fname: { [Students.sequelize.Op.iLike]: `%${search}%` } },
      { lname: { [Students.sequelize.Op.iLike]: `%${search}%` } },
      { email: { [Students.sequelize.Op.iLike]: `%${search}%` } },
      { matric_number: { [Students.sequelize.Op.iLike]: `%${search}%` } },
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
 * Get single student by ID
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
        as: "courses",
        include: [
          {
            model: Courses,
            as: "course",
            attributes: ["id", "title", "code"],
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

  // Create student
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
      [Students.sequelize.fn("COUNT", Students.sequelize.col("id")), "count"],
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
