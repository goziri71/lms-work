import { Op } from "sequelize";
import { Staff } from "../../../models/auth/staff.js";
import { Courses } from "../../../models/course/courses.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";
import { authService } from "../../../service/authservice.js";
import { emailService } from "../../../services/emailService.js";
import { EmailLog } from "../../../models/email/emailLog.js";
import { WspAdmin } from "../../../models/admin/wspAdmin.js";

/**
 * Get all staff with pagination
 */
export const getAllStaff = TryCatchFunction(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;

  const where = {};
  // Note: admin_status column doesn't exist in staff table
  // if (status) where.admin_status = status;
  if (search) {
    where[Op.or] = [
      { full_name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows: staff } = await Staff.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    attributes: { exclude: ["password", "token"] },
    include: [
      {
        model: Courses,
        as: "courses",
        attributes: ["id", "title", "course_code"],
      },
    ],
    order: [["id", "DESC"]], // Order by ID (newest first)
  });

  res.status(200).json({
    success: true,
    message: "Staff retrieved successfully",
    data: {
      staff,
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
 * Create new staff
 */
export const createStaff = TryCatchFunction(async (req, res) => {
  const { email, password, fname, lname, ...otherData } = req.body;

  if (!email || !password || !fname || !lname) {
    throw new ErrorClass(
      "Email, password, first name, and last name are required",
      400
    );
  }

  const existingStaff = await Staff.findOne({
    where: { email: email.toLowerCase() },
  });

  if (existingStaff) {
    throw new ErrorClass("Email already exists", 409);
  }

  const hashedPassword = authService.hashPassword(password);

  const fullName = `${fname} ${lname}`.trim();

  // Remove full_name from otherData to prevent override
  const { full_name: _, ...safeOtherData } = otherData;

  const staff = await Staff.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    ...safeOtherData,
    full_name: fullName, // Set after otherData to ensure it's not overridden
    date: new Date(),
  });

  await logAdminActivity(
    req.user.id,
    "created_staff",
    "staff",
    staff.id,
    `Created staff: ${fname} ${lname}`,
    { staff_id: staff.id, email }
  );

  res.status(201).json({
    success: true,
    message: "Staff created successfully",
    data: {
      staff: {
        id: staff.id,
        fullName: staff.full_name,
        email: staff.email,
      },
    },
  });
});

/**
 * Update staff
 */
export const updateStaff = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  delete updateData.password;

  const staff = await Staff.findByPk(id);

  if (!staff) {
    throw new ErrorClass("Staff not found", 404);
  }

  await staff.update(updateData);

  await logAdminActivity(
    req.user.id,
    "updated_staff",
    "staff",
    id,
    `Updated staff: ${staff.fname} ${staff.lname}`,
    { staff_id: id }
  );

  res.status(200).json({
    success: true,
    message: "Staff updated successfully",
    data: { staff },
  });
});

/**
 * Deactivate staff
 */
export const deactivateStaff = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const staff = await Staff.findByPk(id);

  if (!staff) {
    throw new ErrorClass("Staff not found", 404);
  }

  // Note: admin_status column doesn't exist in staff table
  // await staff.update({ admin_status: "inactive" });
  // Staff deactivation would require adding the column to the database first

  await logAdminActivity(
    req.user.id,
    "deactivated_staff",
    "staff",
    id,
    `Deactivated staff: ${staff.fname} ${staff.lname}`
  );

  res.status(200).json({
    success: true,
    message: "Staff deactivated successfully",
  });
});

/**
 * Reset staff password
 */
export const resetStaffPassword = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    throw new ErrorClass("New password is required", 400);
  }

  const staff = await Staff.findByPk(id);

  if (!staff) {
    throw new ErrorClass("Staff not found", 404);
  }

  const hashedPassword = authService.hashPassword(newPassword);
  await staff.update({ password: hashedPassword });

  // Get admin name for email
  const admin = await WspAdmin.findByPk(req.user.id);
  const adminName = admin ? `${admin.fname} ${admin.lname}` : "Administrator";

  // Send password changed notification email
  try {
    await emailService.sendPasswordChangedEmail(staff, {
      userType: "staff",
      ipAddress: req.ip || req.connection.remoteAddress,
      device: req.get("user-agent") || "Unknown",
      changedBy: adminName,
    });

    // Log email sent
    await EmailLog.create({
      recipient_email: staff.email,
      recipient_type: "staff",
      recipient_id: staff.id,
      email_type: "password_changed",
      subject: "Your Password Has Been Changed",
      status: "sent",
    });
  } catch (emailError) {
    console.error("Error sending password changed email:", emailError);
    // Don't throw error - password was reset successfully
  }

  await logAdminActivity(
    req.user.id,
    "reset_staff_password",
    "staff",
    id,
    `Reset password for staff: ${staff.fname} ${staff.lname}`
  );

  res.status(200).json({
    success: true,
    message: "Staff password reset successfully. Notification email sent.",
  });
});
