import { WspAdmin } from "../../../models/admin/wspAdmin.js";
import { AdminActivityLog } from "../../../models/admin/adminActivityLog.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";
import { authService } from "../../../service/authservice.js";
import { emailService } from "../../../services/emailService.js";
import { EmailLog } from "../../../models/email/emailLog.js";

/**
 * Get all admins (Super Admin only)
 */
export const getAllAdmins = TryCatchFunction(async (req, res) => {
  const admins = await WspAdmin.findAll({
    attributes: { exclude: ["password", "password_reset_token", "two_factor_secret"] },
    order: [["created_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Admins retrieved successfully",
    data: { admins, count: admins.length },
  });
});

/**
 * Create new admin (Super Admin only)
 */
export const createAdmin = TryCatchFunction(async (req, res) => {
  const { email, password, fname, lname, role, permissions } = req.body;

  if (!email || !password || !fname || !lname) {
    throw new ErrorClass("Email, password, first name, and last name are required", 400);
  }

  const existingAdmin = await WspAdmin.findOne({
    where: { email: email.toLowerCase() },
  });

  if (existingAdmin) {
    throw new ErrorClass("Admin with this email already exists", 409);
  }

  const hashedPassword = authService.hashPassword(password);

  const admin = await WspAdmin.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    fname,
    lname,
    role: role || "wpu_admin",
    permissions: permissions || undefined,
    status: "active",
    created_by: req.user.id,
  });

  // Send welcome email with temporary password
  try {
    await emailService.sendAdminWelcomeEmail(admin, password);

    // Log email sent
    await EmailLog.create({
      recipient_email: admin.email,
      recipient_type: "admin",
      recipient_id: admin.id,
      email_type: "admin_welcome",
      subject: "Welcome to WPU Admin System - Your Account is Ready!",
      status: "sent",
    });
  } catch (emailError) {
    console.error("Error sending admin welcome email:", emailError);
    // Don't throw error - admin was created successfully
  }

  await logAdminActivity(
    req.user.id,
    "created_admin",
    "admin",
    admin.id,
    `Created ${admin.role}: ${fname} ${lname}`,
    { admin_id: admin.id, role: admin.role }
  );

  res.status(201).json({
    success: true,
    message: "Admin created successfully. Welcome email sent.",
    data: {
      admin: {
        id: admin.id,
        firstName: admin.fname,
        lastName: admin.lname,
        email: admin.email,
        role: admin.role,
      },
    },
  });
});

/**
 * Update admin (Super Admin only)
 */
export const updateAdmin = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  delete updateData.password;

  const admin = await WspAdmin.findByPk(id);

  if (!admin) {
    throw new ErrorClass("Admin not found", 404);
  }

  await admin.update(updateData);

  await logAdminActivity(
    req.user.id,
    "updated_admin",
    "admin",
    id,
    `Updated admin: ${admin.fname} ${admin.lname}`
  );

  res.status(200).json({
    success: true,
    message: "Admin updated successfully",
    data: { admin },
  });
});

/**
 * Deactivate admin (Super Admin only)
 */
export const deactivateAdmin = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const admin = await WspAdmin.findByPk(id);

  if (!admin) {
    throw new ErrorClass("Admin not found", 404);
  }

  if (admin.role === "super_admin") {
    throw new ErrorClass("Cannot deactivate super admin", 403);
  }

  await admin.update({ status: "inactive" });

  await logAdminActivity(
    req.user.id,
    "deactivated_admin",
    "admin",
    id,
    `Deactivated admin: ${admin.fname} ${admin.lname}`
  );

  res.status(200).json({
    success: true,
    message: "Admin deactivated successfully",
  });
});

/**
 * Get admin activity logs
 */
export const getAdminActivityLogs = TryCatchFunction(async (req, res) => {
  const { admin_id, action, page = 1, limit = 50 } = req.query;

  const where = {};
  if (admin_id) where.admin_id = admin_id;
  if (action) where.action = action;

  const offset = (page - 1) * limit;

  const { count, rows: logs } = await AdminActivityLog.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: WspAdmin,
        as: "admin",
        attributes: ["id", "fname", "lname", "email", "role"],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Activity logs retrieved successfully",
    data: {
      logs,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    },
  });
});

