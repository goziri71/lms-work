import { Students } from "../../models/auth/student.js";
import { Staff } from "../../models/auth/staff.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { authService } from "../../service/authservice.js";
import { emailService } from "../../services/emailService.js";
import { EmailLog } from "../../models/email/emailLog.js";
import { EmailPreference } from "../../models/email/emailPreference.js";
import { Op, fn, col } from "sequelize";
import crypto from "crypto";

// Student Login using Sequelize ORM
export const studentLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  try {
    // Find student by email using Sequelize ORM
    const student = await Students.findOne({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (!student) {
      throw new ErrorClass("Invalid email or password", 401);
    }

    // Students can login regardless of admin_status
    // admin_status is just informational (pending/active/inactive) for display purposes

    // Compare password
    const isPasswordValid = await authService.comparePassword(
      password,
      student.password
    );

    if (!isPasswordValid) {
      throw new ErrorClass("Invalid email or password", 401);
    }

    // Update student record if needed (you can add a lastLogin field later)
    // await student.update({ lastLogin: new Date() });

    // Generate JWT token using your actual model fields
    const accessToken = await authService.generateAccessToken({
      id: student.id,
      userType: "student",
      email: student.email,
      firstName: student.fname,
      lastName: student.lname,
      facultyId: student.faculty_id,
      programId: student.program_id,
      level: student.level,
    });

    // Prepare student data (exclude password and sensitive fields)
    const studentData = {
      id: student.id,
      firstName: student.fname,
      lastName: student.lname,
      email: student.email,
      gender: student.gender,
      phone: student.phone,
      level: student.level,
      matricNumber: student.matric_number,
      facultyId: student.faculty_id,
      programId: student.program_id,
      studyMode: student.study_mode,
      adminStatus: student.admin_status,
      walletBalance: student.wallet_balance,
    };

    res.status(200).json({
      success: true,
      message: "Student login successful",
      data: {
        user: studentData,
        accessToken,
        userType: "student",
        expiresIn: 14400, // 4 hours in seconds
      },
    });
  } catch (error) {
    console.error("Database error:", error);
    throw new ErrorClass("Database connection error", 500);
  }
});

// Staff Login using Sequelize ORM
export const staffLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  try {
    // Find staff by email using Sequelize ORM with associated courses
    const staff = await Staff.findOne({
      where: {
        email: email.toLowerCase(),
      },
      include: [
        {
          association: "courses", // This uses the association we defined
          required: false, // LEFT JOIN instead of INNER JOIN
        },
      ],
    });

    if (!staff) {
      throw new ErrorClass("user must be a staff to login", 401);
    }

    // Compare password
    const isPasswordValid = await authService.comparePassword(
      password,
      staff.password
    );

    if (!isPasswordValid) {
      throw new ErrorClass("Invalid email or password", 401);
    }

    // Generate JWT token
    const accessToken = await authService.generateAccessToken({
      id: staff.id,
      userType: "staff",
      email: staff.email,
      fullName: staff.full_name,
      phone: staff.phone,
    });

    // Prepare staff data (exclude password)
    const staffData = {
      id: staff.id,
      fullName: staff.full_name,
      email: staff.email,
      phone: staff.phone,
      linkedin: staff.linkedin,
      googleScholar: staff.google_scholar,
      researchAreas: staff.research_areas,
      coursesCount: staff.courses ? staff.courses.length : 0,
    };

    res.status(200).json({
      success: true,
      message: "Staff login successful",
      data: {
        user: staffData,
        accessToken,
        userType: "staff",
        expiresIn: 14400, // 4 hours in seconds
      },
    });
  } catch (error) {
    console.error("Database error:", error);
    throw new ErrorClass("Database connection error", 500);
  }
});

// Universal Login using Sequelize ORM
export const login = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  let user = null;
  let userType = null;

  // Try to find user in students table first
  // Normalize email: remove all non-printable characters, trim whitespace, and convert to lowercase
  // This handles hidden characters that might exist in the database
  const normalizedEmail = email
    .replace(/[^\x20-\x7E]/g, "") // Remove non-printable ASCII characters
    .trim()
    .toLowerCase();

  // First try exact match
  let student = await Students.findOne({
    where: {
      email: normalizedEmail,
    },
  });

  // If exact match fails, try case-insensitive search (handles encoding/case issues)
  if (!student) {
    student = await Students.findOne({
      where: {
        email: {
          [Op.iLike]: normalizedEmail, // PostgreSQL case-insensitive exact match
        },
      },
    });
  }

  // If still not found, try with database-level cleaning using literal SQL (handles hidden chars in DB)
  if (!student) {
    const { literal } = await import("sequelize");
    // Escape single quotes in email to prevent SQL injection
    const escapedEmail = normalizedEmail.replace(/'/g, "''");
    student = await Students.findOne({
      where: literal(
        `LOWER(REGEXP_REPLACE(TRIM(email), '[^\\x20-\\x7E]', '', 'g')) = '${escapedEmail}'`
      ),
    });
  }

  if (student) {
    user = student;
    userType = "student";
  } else {
    // Try staff table if not found in students
    const normalizedStaffEmail = email.trim().toLowerCase();
    const staff = await Staff.findOne({
      where: {
        email: normalizedStaffEmail,
      },
      include: [
        {
          association: "courses",
          required: false,
        },
      ],
    });

    if (staff) {
      user = staff;
      userType = "staff";
    }
  }

  if (!user) {
    throw new ErrorClass("user not found", 401);
  }

  // Students can login regardless of admin_status
  // admin_status is just informational (pending/active/inactive) for display purposes

  // Compare password
  const isPasswordValid = await authService.comparePassword(
    password,
    user.password
  );

  if (!isPasswordValid) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Generate tokens with appropriate payload
  const tokenPayload = {
    id: user.id,
    userType,
    email: user.email,
  };

  if (userType === "student") {
    tokenPayload.firstName = user.fname;
    tokenPayload.lastName = user.lname;
    tokenPayload.level = user.level;
    tokenPayload.facultyId = user.faculty_id;
  } else {
    tokenPayload.fullName = user.full_name;
    tokenPayload.phone = user.phone;
  }

  const accessToken = await authService.generateAccessToken(tokenPayload);

  // Prepare user data based on type
  let userData = {
    id: user.id,
    email: user.email,
    userType,
  };

  if (userType === "student") {
    userData = {
      ...userData,
      firstName: user.fname,
      lastName: user.lname,
      gender: user.gender,
      phone: user.phone,
      level: user.level,
      status: user.admin_status,
      matricNumber: user.matric_number,
      facultyId: user.faculty_id,
      programId: user.program_id,
      studyMode: user.study_mode,
      adminStatus: user.admin_status,
      walletBalance: user.wallet_balance,
    };
  } else {
    userData = {
      ...userData,
      fullName: user.full_name,
      phone: user.phone,
      linkedin: user.linkedin,
      googleScholar: user.google_scholar,
      researchAreas: user.research_areas,
      coursesCount: user.courses ? user.courses.length : 0,
    };
  }

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: userData,
      accessToken,
      userType,
      expiresIn: 14400, // 4 hours in seconds
    },
  });
});

// Get user profile with associations
export const getProfile = TryCatchFunction(async (req, res) => {
  const { userType, id } = req.user; // From JWT middleware

  let user = null;

  if (userType === "student") {
    user = await Students.findByPk(id, {
      attributes: { exclude: ["password", "token"] }, // Exclude sensitive fields
    });
  } else if (userType === "staff") {
    user = await Staff.findByPk(id, {
      include: [
        {
          association: "courses",
          required: false,
        },
      ],
      attributes: { exclude: ["password", "token"] },
    });
  }

  if (!user) {
    throw new ErrorClass("User not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Profile retrieved successfully",
    data: {
      user,
      userType,
    },
  });
});

// Refresh token endpoint - REMOVED (no longer using refresh tokens)

// Logout
export const logout = TryCatchFunction(async (req, res) => {
  // Since we're using stateless JWT tokens, logout is handled client-side
  // by simply removing the token from storage

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

// Change student password (requires current password)
export const changeStudentPassword = TryCatchFunction(async (req, res) => {
  const { id } = req.user;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ErrorClass("Current password and new password are required", 400);
  }

  if (currentPassword === newPassword) {
    throw new ErrorClass(
      "New password must be different from current password",
      400
    );
  }

  // Validate new password strength (optional - add your requirements)
  if (newPassword.length < 6) {
    throw new ErrorClass(
      "New password must be at least 6 characters long",
      400
    );
  }

  const student = await Students.findByPk(id);

  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Verify current password
  const isPasswordValid = await authService.comparePassword(
    currentPassword,
    student.password
  );

  if (!isPasswordValid) {
    throw new ErrorClass("Current password is incorrect", 401);
  }

  // Hash and update password
  const hashedPassword = authService.hashPassword(newPassword);
  await student.update({ password: hashedPassword });

  // Send password changed notification email
  try {
    await emailService.sendPasswordChangedEmail(student, {
      userType: "student",
      ipAddress: req.ip || req.connection.remoteAddress,
      device: req.get("user-agent") || "Unknown",
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
    // Don't throw error - password was changed successfully
  }

  res.status(200).json({
    success: true,
    message: "Password changed successfully. Notification email sent.",
  });
});

// Update student profile
export const updateStudentProfile = TryCatchFunction(async (req, res) => {
  const { id } = req.user;
  const updateData = req.body;

  // Remove sensitive fields that shouldn't be updated via this endpoint
  delete updateData.password;
  delete updateData.email;
  delete updateData.matric_number;
  delete updateData.admin_status;

  const student = await Students.findByPk(id);

  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  await student.update(updateData);

  // Return updated student data (excluding sensitive fields)
  const updatedStudent = await Students.findByPk(id, {
    attributes: { exclude: ["password", "token"] },
  });

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: updatedStudent,
    },
  });
});

// Update staff profile
export const updateStaffProfile = TryCatchFunction(async (req, res) => {
  const { id } = req.user;
  const updateData = req.body;

  // Remove sensitive fields
  delete updateData.password;
  delete updateData.email;

  const staff = await Staff.findByPk(id);

  if (!staff) {
    throw new ErrorClass("Staff not found", 404);
  }

  await staff.update(updateData);

  // Return updated staff data with courses
  const updatedStaff = await Staff.findByPk(id, {
    include: [
      {
        association: "courses",
        required: false,
      },
    ],
    attributes: { exclude: ["password", "token"] },
  });

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: updatedStaff,
    },
  });
});

// Student Registration with Welcome Email
export const registerStudent = TryCatchFunction(async (req, res) => {
  const { email, password, fname, lname, ...otherData } = req.body;

  // Validate required fields
  if (!email || !password || !fname || !lname) {
    throw new ErrorClass(
      "Email, password, first name, and last name are required",
      400
    );
  }

  // Check if student already exists
  const existingStudent = await Students.findOne({
    where: { email: email.toLowerCase() },
  });

  if (existingStudent) {
    throw new ErrorClass("Student with this email already exists", 409);
  }

  // Hash password
  const hashedPassword = await authService.hashPassword(password);

  // Create student with required defaults
  const student = await Students.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    fname,
    lname,
    admin_status: "active",
    date: new Date(),
    // Required fields with defaults (if not provided)
    currency: otherData.currency || "NGN",
    referral_code: otherData.referral_code || "",
    designated_institute: otherData.designated_institute || 0,
    foreign_student: otherData.foreign_student || 0,
    ...otherData,
  });

  // Create default email preferences
  try {
    await EmailPreference.create({
      user_id: student.id,
      user_type: "student",
      receive_course_notifications: true,
      receive_grade_notifications: true,
      receive_exam_reminders: true,
      receive_quiz_reminders: true,
      receive_announcements: true,
    });
  } catch (prefError) {
    console.error("Error creating email preferences:", prefError);
  }

  // Send welcome email (non-blocking)
  emailService
    .sendWelcomeEmail(
      {
        email: student.email,
        name: `${student.fname} ${student.lname}`,
      },
      "student"
    )
    .then((result) => {
      // Log email send
      EmailLog.create({
        user_id: student.id,
        user_type: "student",
        recipient_email: student.email,
        recipient_name: `${student.fname} ${student.lname}`,
        email_type: "welcome",
        subject: "Welcome to Pinnacle University LMS",
        status: result.success ? "sent" : "failed",
        error_message: result.success ? null : result.message,
        sent_at: result.success ? new Date() : null,
      }).catch((logError) =>
        console.error("Error logging welcome email:", logError)
      );
    })
    .catch((error) => {
      console.error("Error sending welcome email:", error);
    });

  // Prepare response data (exclude password)
  const studentData = {
    id: student.id,
    firstName: student.fname,
    lastName: student.lname,
    email: student.email,
    adminStatus: student.admin_status,
  };

  res.status(201).json({
    success: true,
    message: "Student registered successfully. Welcome email sent.",
    data: {
      user: studentData,
    },
  });
});

// Staff Registration with Welcome Email
export const registerStaff = TryCatchFunction(async (req, res) => {
  const { email, password, fname, lname, ...otherData } = req.body;

  // Validate required fields
  if (!email || !password || !fname || !lname) {
    throw new ErrorClass(
      "Email, password, first name, and last name are required",
      400
    );
  }

  // Check if staff already exists
  const existingStaff = await Staff.findOne({
    where: { email: email.toLowerCase() },
  });

  if (existingStaff) {
    throw new ErrorClass("Staff with this email already exists", 409);
  }

  // Hash password
  const hashedPassword = await authService.hashPassword(password);

  // Create staff
  const staff = await Staff.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    fname,
    lname,
    admin_status: "active",
    date: new Date(),
    ...otherData,
  });

  // Create default email preferences
  try {
    await EmailPreference.create({
      user_id: staff.id,
      user_type: "staff",
      receive_course_notifications: true,
      receive_announcements: true,
    });
  } catch (prefError) {
    console.error("Error creating email preferences:", prefError);
  }

  // Send welcome email (non-blocking)
  emailService
    .sendWelcomeEmail(
      {
        email: staff.email,
        name: `${staff.fname} ${staff.lname}`,
      },
      "staff"
    )
    .then((result) => {
      // Log email send
      EmailLog.create({
        user_id: staff.id,
        user_type: "staff",
        recipient_email: staff.email,
        recipient_name: `${staff.fname} ${staff.lname}`,
        email_type: "welcome",
        subject: "Welcome to Pinnacle University LMS",
        status: result.success ? "sent" : "failed",
        error_message: result.success ? null : result.message,
        sent_at: result.success ? new Date() : null,
      }).catch((logError) =>
        console.error("Error logging welcome email:", logError)
      );
    })
    .catch((error) => {
      console.error("Error sending welcome email:", error);
    });

  // Prepare response data (exclude password)
  const staffData = {
    id: staff.id,
    firstName: staff.fname,
    lastName: staff.lname,
    email: staff.email,
    adminStatus: staff.admin_status,
  };

  res.status(201).json({
    success: true,
    message: "Staff registered successfully. Welcome email sent.",
    data: {
      user: staffData,
    },
  });
});

// Request Password Reset
export const requestPasswordReset = TryCatchFunction(async (req, res) => {
  const { email, userType } = req.body;

  // Validate input
  if (!email || !userType) {
    throw new ErrorClass("Email and user type are required", 400);
  }

  if (!["student", "staff"].includes(userType)) {
    throw new ErrorClass(
      "Invalid user type. Must be 'student' or 'staff'",
      400
    );
  }

  // Find user based on type
  const Model = userType === "student" ? Students : Staff;
  const user = await Model.findOne({
    where: { email: email.toLowerCase() },
  });

  // Don't reveal if user exists or not (security best practice)
  if (!user) {
    return res.status(200).json({
      success: true,
      message: "If the email exists, a password reset link has been sent.",
    });
  }

  // Generate secure reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Save hashed token to user (expires in 1 hour)
  await user.update({
    token: hashedToken,
    // If you have a token_expires field, set it to: new Date(Date.now() + 3600000)
  });

  // Create reset URL (adjust based on your frontend)
  const resetUrl = `${
    process.env.FRONTEND_URL || "https://pinnacleuniversity.co"
  }/reset-password?token=${resetToken}&type=${userType}`;

  // Send password reset email
  try {
    const result = await emailService.sendPasswordResetEmail(
      {
        email: user.email,
        name: `${user.fname} ${user.lname}`,
      },
      resetToken,
      resetUrl
    );

    // Log email send with detailed error information
    // Option 1: Explicit (current approach - preserves exact values at time of sending)
    await EmailLog.create({
      user_id: user.id,
      user_type: userType,
      recipient_email: user.email,
      recipient_name: `${user.fname} ${user.lname}`,
      email_type: "password_reset",
      subject: "Password Reset Request - Pinnacle University",
      status: result.success ? "sent" : "failed",
      error_message: result.success
        ? null
        : result.message || JSON.stringify(result.error),
      sent_at: result.success ? new Date() : null,
      metadata: result.success
        ? null
        : {
            error_details: result.error,
            timestamp: new Date().toISOString(),
          },
    });

    // Option 2: Simplified (auto-fetches from user table - can use this instead)
    // await EmailLog.createForUser({
    //   user_id: user.id,
    //   user_type: userType,
    //   email_type: "password_reset",
    //   subject: "Password Reset Request - Pinnacle University",
    //   status: result.success ? "sent" : "failed",
    //   error_message: result.success ? null : (result.message || JSON.stringify(result.error)),
    //   sent_at: result.success ? new Date() : null,
    //   metadata: result.success ? null : {
    //     error_details: result.error,
    //     timestamp: new Date().toISOString(),
    //   },
    // });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    // Log the error to email_logs even if EmailLog.create fails
    try {
      await EmailLog.create({
        user_id: user.id,
        user_type: userType,
        recipient_email: user.email,
        recipient_name: `${user.fname} ${user.lname}`,
        email_type: "password_reset",
        subject: "Password Reset Request - Pinnacle University",
        status: "failed",
        error_message: error.message || "Unknown error occurred",
        sent_at: null,
      });
    } catch (logError) {
      console.error("Failed to log email error:", logError);
    }
    // Don't throw error - still return success to prevent email enumeration
  }

  res.status(200).json({
    success: true,
    message: "If the email exists, a password reset link has been sent.",
  });
});

// Reset Password
export const resetPassword = TryCatchFunction(async (req, res) => {
  const { token, newPassword, userType } = req.body;

  // Validate input
  if (!token || !newPassword || !userType) {
    throw new ErrorClass(
      "Token, new password, and user type are required",
      400
    );
  }

  if (!["student", "staff"].includes(userType)) {
    throw new ErrorClass("Invalid user type", 400);
  }

  // Hash the token from URL
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Find user with this token
  const Model = userType === "student" ? Students : Staff;
  const user = await Model.findOne({
    where: { token: hashedToken },
  });

  if (!user) {
    throw new ErrorClass(
      "Invalid or expired reset token. Please request a new password reset.",
      400
    );
  }

  // Hash new password
  const hashedPassword = await authService.hashPassword(newPassword);

  // Update password and clear token
  await user.update({
    password: hashedPassword,
    token: null,
  });

  res.status(200).json({
    success: true,
    message:
      "Password has been reset successfully. You can now login with your new password.",
  });
});
