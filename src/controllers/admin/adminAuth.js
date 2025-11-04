import { WspAdmin } from "../../models/admin/wspAdmin.js";
import { AdminActivityLog } from "../../models/admin/adminActivityLog.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { authService } from "../../service/authservice.js";
import { emailService } from "../../services/emailService.js";
import { EmailLog } from "../../models/email/emailLog.js";
import crypto from "crypto";

/**
 * Admin Login
 * Separate from staff/student login
 */
export const adminLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  // Find admin by email
  const admin = await WspAdmin.findOne({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (!admin) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Check if admin account is active
  if (admin.status !== "active") {
    throw new ErrorClass(
      `Admin account is ${admin.status}. Please contact system administrator.`,
      401
    );
  }

  // Verify password
  const isPasswordValid = await authService.comparePassword(
    password,
    admin.password
  );

  if (!isPasswordValid) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Update last login
  await admin.update({ last_login: new Date() });

  // Log login activity
  await AdminActivityLog.create({
    admin_id: admin.id,
    action: "admin_login",
    target_type: "admin",
    target_id: admin.id,
    description: `${admin.fname} ${admin.lname} logged in`,
    ip_address: req.ip || req.connection.remoteAddress,
    user_agent: req.get("user-agent"),
    result: "success",
  });

  // Generate JWT token
  const accessToken = await authService.generateAccessToken({
    id: admin.id,
    userType: "admin",
    role: admin.role,
    email: admin.email,
    firstName: admin.fname,
    lastName: admin.lname,
    permissions: admin.permissions,
  });

  // Prepare admin data (exclude sensitive info)
  const adminData = {
    id: admin.id,
    firstName: admin.fname,
    lastName: admin.lname,
    email: admin.email,
    role: admin.role,
    permissions: admin.permissions,
    status: admin.status,
    profileImage: admin.profile_image,
  };

  res.status(200).json({
    success: true,
    message: "Admin login successful",
    data: {
      admin: adminData,
      accessToken,
      userType: "admin",
      expiresIn: 14400, // 4 hours
    },
  });
});

/**
 * Admin Logout
 */
export const adminLogout = TryCatchFunction(async (req, res) => {
  const { id } = req.user;

  // Log logout activity
  await AdminActivityLog.create({
    admin_id: id,
    action: "admin_logout",
    target_type: "admin",
    target_id: id,
    description: "Admin logged out",
    ip_address: req.ip || req.connection.remoteAddress,
    result: "success",
  });

  res.status(200).json({
    success: true,
    message: "Admin logout successful",
  });
});

/**
 * Get Current Admin Profile
 */
export const getAdminProfile = TryCatchFunction(async (req, res) => {
  const { id } = req.user;

  const admin = await WspAdmin.findByPk(id, {
    attributes: {
      exclude: ["password", "password_reset_token", "two_factor_secret", "token"],
    },
  });

  if (!admin) {
    throw new ErrorClass("Admin not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Admin profile retrieved successfully",
    data: {
      admin,
    },
  });
});

/**
 * Update Admin Profile
 */
export const updateAdminProfile = TryCatchFunction(async (req, res) => {
  const { id } = req.user;
  const updateData = req.body;

  // Remove sensitive fields that shouldn't be updated via this endpoint
  delete updateData.password;
  delete updateData.role;
  delete updateData.permissions;
  delete updateData.status;

  const admin = await WspAdmin.findByPk(id);

  if (!admin) {
    throw new ErrorClass("Admin not found", 404);
  }

  await admin.update(updateData);

  // Log profile update
  await AdminActivityLog.create({
    admin_id: id,
    action: "updated_profile",
    target_type: "admin",
    target_id: id,
    description: "Admin updated their profile",
    result: "success",
  });

  res.status(200).json({
    success: true,
    message: "Admin profile updated successfully",
    data: {
      admin: {
        id: admin.id,
        firstName: admin.fname,
        lastName: admin.lname,
        email: admin.email,
        role: admin.role,
        phone: admin.phone,
        profileImage: admin.profile_image,
      },
    },
  });
});

/**
 * Request Password Reset
 */
export const requestAdminPasswordReset = TryCatchFunction(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ErrorClass("Email is required", 400);
  }

  const admin = await WspAdmin.findOne({
    where: { email: email.toLowerCase() },
  });

  // Don't reveal if admin exists (security best practice)
  if (!admin) {
    return res.status(200).json({
      success: true,
      message: "If the email exists, a password reset link has been sent.",
    });
  }

  // Generate reset token
  const crypto = await import("crypto");
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  // Save hashed token
  await admin.update({
    password_reset_token: hashedToken,
  });

  // Send password reset email
  try {
    await emailService.sendPasswordResetEmail(
      {
        email: admin.email,
        fname: admin.fname,
        lname: admin.lname,
      },
      resetToken
    );

    // Log email sent
    await EmailLog.create({
      recipient_email: admin.email,
      recipient_type: "admin",
      recipient_id: admin.id,
      email_type: "password_reset",
      subject: "Password Reset Request",
      status: "sent",
    });
  } catch (emailError) {
    console.error("Error sending password reset email:", emailError);
    // Don't throw error - just log it
  }

  res.status(200).json({
    success: true,
    message: "If the email exists, a password reset link has been sent.",
  });
});

/**
 * Reset Password
 */
export const resetAdminPassword = TryCatchFunction(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw new ErrorClass("Token and new password are required", 400);
  }

  const crypto = await import("crypto");
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const admin = await WspAdmin.findOne({
    where: { password_reset_token: hashedToken },
  });

  if (!admin) {
    throw new ErrorClass("Invalid or expired reset token", 400);
  }

  // Hash new password
  const hashedPassword = authService.hashPassword(newPassword);

  // Update password and clear token
  await admin.update({
    password: hashedPassword,
    password_reset_token: null,
  });

  // Send password changed notification email
  try {
    await emailService.sendPasswordChangedEmail(admin, {
      userType: "admin",
      ipAddress: req.ip || req.connection.remoteAddress,
      device: req.get("user-agent") || "Unknown",
    });

    // Log email sent
    await EmailLog.create({
      recipient_email: admin.email,
      recipient_type: "admin",
      recipient_id: admin.id,
      email_type: "password_changed",
      subject: "Your Password Has Been Changed",
      status: "sent",
    });
  } catch (emailError) {
    console.error("Error sending password changed email:", emailError);
    // Don't throw error - password was reset successfully
  }

  // Log password reset
  await AdminActivityLog.create({
    admin_id: admin.id,
    action: "password_reset",
    target_type: "admin",
    target_id: admin.id,
    description: "Admin reset their password",
    result: "success",
  });

  res.status(200).json({
    success: true,
    message: "Password reset successful. You can now login with your new password.",
  });
});

