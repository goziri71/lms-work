import crypto from "crypto";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { OrganizationUser } from "../../models/marketplace/organizationUser.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { authService } from "../../service/authservice.js";
import { emailService } from "../../services/emailService.js";

/**
 * Sole Tutor Registration
 */
export const registerSoleTutor = TryCatchFunction(async (req, res) => {
  const {
    email,
    password,
    fname,
    lname,
    mname,
    phone,
    bio,
    specialization,
    qualifications,
    experience_years,
    address,
    country,
  } = req.body;

  if (!email || !password || !fname || !lname) {
    throw new ErrorClass(
      "Email, password, first name, and last name are required",
      400
    );
  }

  // Check if email already exists
  const existingTutor = await SoleTutor.findOne({
    where: { email: email.toLowerCase() },
  });

  if (existingTutor) {
    throw new ErrorClass("Tutor with this email already exists", 409);
  }

  // Hash password
  const hashedPassword = authService.hashPassword(password);

  // Create tutor (status: pending - awaiting approval)
  const tutor = await SoleTutor.create({
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    fname: fname.trim(),
    lname: lname.trim(),
    mname: mname?.trim() || null,
    phone: phone?.trim() || null,
    bio: bio?.trim() || null,
    specialization: specialization?.trim() || null,
    qualifications: qualifications?.trim() || null,
    experience_years: experience_years || 0,
    address: address?.trim() || null,
    country: country?.trim() || null,
    status: "pending", // Requires admin approval
    verification_status: "unverified",
  });

  res.status(201).json({
    success: true,
    message:
      "Registration successful! Your account is pending approval. You will be notified once approved.",
    data: {
      tutor: {
        id: tutor.id,
        email: tutor.email,
        fname: tutor.fname,
        lname: tutor.lname,
        status: tutor.status,
      },
    },
  });
});

/**
 * Organization Registration
 */
export const registerOrganization = TryCatchFunction(async (req, res) => {
  const {
    name,
    email,
    password,
    description,
    website,
    phone,
    address,
    country,
    registration_number,
    tax_id,
    contact_person,
    contact_email,
    contact_phone,
  } = req.body;

  if (!name || !email || !password) {
    throw new ErrorClass("Name, email, and password are required", 400);
  }

  // Check if email already exists
  const existingOrg = await Organization.findOne({
    where: { email: email.toLowerCase() },
  });

  if (existingOrg) {
    throw new ErrorClass("Organization with this email already exists", 409);
  }

  // Hash password
  const hashedPassword = authService.hashPassword(password);

  // Create organization (status: pending - awaiting approval)
  const organization = await Organization.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    description: description?.trim() || null,
    website: website?.trim() || null,
    phone: phone?.trim() || null,
    address: address?.trim() || null,
    country: country?.trim() || null,
    registration_number: registration_number?.trim() || null,
    tax_id: tax_id?.trim() || null,
    contact_person: contact_person?.trim() || null,
    contact_email: contact_email?.trim() || null,
    contact_phone: contact_phone?.trim() || null,
    status: "pending", // Requires admin approval
    verification_status: "unverified",
  });

  res.status(201).json({
    success: true,
    message:
      "Registration successful! Your organization account is pending approval. You will be notified once approved.",
    data: {
      organization: {
        id: organization.id,
        name: organization.name,
        email: organization.email,
        status: organization.status,
      },
    },
  });
});

/**
 * Sole Tutor Login
 */
export const soleTutorLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  const tutor = await SoleTutor.findOne({
    where: { email: email.toLowerCase() },
  });

  if (!tutor) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Check status
  if (tutor.status === "pending") {
    throw new ErrorClass(
      "Your account is pending approval. Please wait for admin approval.",
      403
    );
  }

  if (tutor.status === "rejected") {
    throw new ErrorClass(
      "Your account has been rejected. Please contact support.",
      403
    );
  }

  if (tutor.status === "suspended") {
    throw new ErrorClass(
      "Your account has been suspended. Please contact support.",
      403
    );
  }

  // Verify password
  const isPasswordValid = await authService.comparePassword(
    password,
    tutor.password
  );

  if (!isPasswordValid) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Update last login
  await tutor.update({ last_login: new Date() });

  // Generate JWT token
  const accessToken = await authService.generateAccessToken({
    id: tutor.id,
    userType: "sole_tutor",
    email: tutor.email,
    firstName: tutor.fname,
    lastName: tutor.lname,
    status: tutor.status,
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      tutor: {
        id: tutor.id,
        fname: tutor.fname,
        lname: tutor.lname,
        email: tutor.email,
        status: tutor.status,
        wallet_balance: tutor.wallet_balance,
        rating: tutor.rating,
      },
      accessToken,
      userType: "sole_tutor",
      expiresIn: 14400, // 4 hours
    },
  });
});

/**
 * Organization Login
 */
export const organizationLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  const organization = await Organization.findOne({
    where: { email: email.toLowerCase() },
  });

  if (!organization) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Check status
  if (organization.status === "pending") {
    throw new ErrorClass(
      "Your organization account is pending approval. Please wait for admin approval.",
      403
    );
  }

  if (organization.status === "rejected") {
    throw new ErrorClass(
      "Your organization account has been rejected. Please contact support.",
      403
    );
  }

  if (organization.status === "suspended") {
    throw new ErrorClass(
      "Your organization account has been suspended. Please contact support.",
      403
    );
  }

  // Verify password
  const isPasswordValid = await authService.comparePassword(
    password,
    organization.password
  );

  if (!isPasswordValid) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Update last login
  await organization.update({ last_login: new Date() });

  // Generate JWT token
  const accessToken = await authService.generateAccessToken({
    id: organization.id,
    userType: "organization",
    email: organization.email,
    name: organization.name,
    status: organization.status,
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      organization: {
        id: organization.id,
        name: organization.name,
        email: organization.email,
        status: organization.status,
        wallet_balance: organization.wallet_balance,
        rating: organization.rating,
      },
      accessToken,
      userType: "organization",
      expiresIn: 14400, // 4 hours
    },
  });
});

/**
 * Organization User Login
 */
export const organizationUserLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  const orgUser = await OrganizationUser.findOne({
    where: { email: email.toLowerCase() },
    include: [
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "status"],
      },
    ],
  });

  if (!orgUser) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Check organization status
  if (orgUser.organization.status !== "active") {
    throw new ErrorClass(
      "Your organization account is not active. Please contact your organization admin.",
      403
    );
  }

  // Check user status
  if (orgUser.status === "suspended") {
    throw new ErrorClass(
      "Your account has been suspended. Please contact your organization admin.",
      403
    );
  }

  if (orgUser.status === "inactive") {
    throw new ErrorClass(
      "Your account is inactive. Please contact your organization admin.",
      403
    );
  }

  // Verify password
  const isPasswordValid = await authService.comparePassword(
    password,
    orgUser.password
  );

  if (!isPasswordValid) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Update last login
  await orgUser.update({ last_login: new Date() });

  // Generate JWT token
  const accessToken = await authService.generateAccessToken({
    id: orgUser.id,
    organizationId: orgUser.organization_id,
    userType: "organization_user",
    role: orgUser.role,
    email: orgUser.email,
    firstName: orgUser.fname,
    lastName: orgUser.lname,
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: {
        id: orgUser.id,
        fname: orgUser.fname,
        lname: orgUser.lname,
        email: orgUser.email,
        role: orgUser.role,
        organization: {
          id: orgUser.organization.id,
          name: orgUser.organization.name,
        },
      },
      accessToken,
      userType: "organization_user",
      expiresIn: 14400, // 4 hours
    },
  });
});

/**
 * Unified Login - Auto-detects Sole Tutor or Organization
 */
export const unifiedTutorLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  // Try to find in SoleTutor table first
  let tutor = await SoleTutor.findOne({
    where: { email: email.toLowerCase() },
  });

  if (tutor) {
    // Check status
    if (tutor.status === "pending") {
      throw new ErrorClass(
        "Your account is pending approval. Please wait for admin approval.",
        403
      );
    }

    if (tutor.status === "rejected") {
      throw new ErrorClass(
        "Your account has been rejected. Please contact support.",
        403
      );
    }

    if (tutor.status === "suspended") {
      throw new ErrorClass(
        "Your account has been suspended. Please contact support.",
        403
      );
    }

    // Verify password
    const isPasswordValid = await authService.comparePassword(
      password,
      tutor.password
    );

    if (!isPasswordValid) {
      throw new ErrorClass("Invalid email or password", 401);
    }

    // Update last login
    await tutor.update({ last_login: new Date() });

    // Generate JWT token
    const accessToken = await authService.generateAccessToken({
      id: tutor.id,
      userType: "sole_tutor",
      email: tutor.email,
      firstName: tutor.fname,
      lastName: tutor.lname,
      status: tutor.status,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        tutor: {
          id: tutor.id,
          fname: tutor.fname,
          lname: tutor.lname,
          email: tutor.email,
          status: tutor.status,
          wallet_balance: tutor.wallet_balance,
          rating: tutor.rating,
        },
        accessToken,
        userType: "sole_tutor",
        expiresIn: 14400, // 4 hours
      },
    });
  }

  // If not found in SoleTutor, try Organization
  const organization = await Organization.findOne({
    where: { email: email.toLowerCase() },
  });

  if (organization) {
    // Check status
    if (organization.status === "pending") {
      throw new ErrorClass(
        "Your organization account is pending approval. Please wait for admin approval.",
        403
      );
    }

    if (organization.status === "rejected") {
      throw new ErrorClass(
        "Your organization account has been rejected. Please contact support.",
        403
      );
    }

    if (organization.status === "suspended") {
      throw new ErrorClass(
        "Your organization account has been suspended. Please contact support.",
        403
      );
    }

    // Verify password
    const isPasswordValid = await authService.comparePassword(
      password,
      organization.password
    );

    if (!isPasswordValid) {
      throw new ErrorClass("Invalid email or password", 401);
    }

    // Update last login
    await organization.update({ last_login: new Date() });

    // Generate JWT token
    const accessToken = await authService.generateAccessToken({
      id: organization.id,
      userType: "organization",
      email: organization.email,
      name: organization.name,
      status: organization.status,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          email: organization.email,
          status: organization.status,
          wallet_balance: organization.wallet_balance,
          rating: organization.rating,
        },
        accessToken,
        userType: "organization",
        expiresIn: 14400, // 4 hours
      },
    });
  }

  // If not found in either table, return generic error
  throw new ErrorClass("Invalid email or password", 401);
});

/**
 * Request Password Reset - Sole Tutor
 */
export const requestPasswordResetSoleTutor = TryCatchFunction(
  async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw new ErrorClass("Email is required", 400);
    }

    // Find tutor
    const tutor = await SoleTutor.findOne({
      where: { email: email.toLowerCase() },
    });

    // Don't reveal if user exists or not (security best practice)
    if (!tutor) {
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

    // Save hashed token to tutor
    await tutor.update({
      password_reset_token: hashedToken,
    });

    // Create reset URL
    const resetUrl = `${
      process.env.FRONTEND_URL || "https://app.lenerme.com"
    }/reset-password?token=${resetToken}&type=sole_tutor`;

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(
        {
          email: tutor.email,
          name: `${tutor.fname || ""} ${tutor.lname || ""}`.trim(),
        },
        resetToken,
        resetUrl
      );
    } catch (error) {
      console.error("Error sending password reset email:", error);
      // Don't throw error - still return success to prevent email enumeration
    }

    res.status(200).json({
      success: true,
      message: "If the email exists, a password reset link has been sent.",
    });
  }
);

/**
 * Request Password Reset - Organization
 */
export const requestPasswordResetOrganization = TryCatchFunction(
  async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw new ErrorClass("Email is required", 400);
    }

    // Find organization
    const organization = await Organization.findOne({
      where: { email: email.toLowerCase() },
    });

    // Don't reveal if user exists or not (security best practice)
    if (!organization) {
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

    // Save hashed token to organization
    await organization.update({
      password_reset_token: hashedToken,
    });

    // Create reset URL
    const resetUrl = `${
      process.env.FRONTEND_URL || "https://app.lenerme.com"
    }/reset-password?token=${resetToken}&type=organization`;

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(
        {
          email: organization.email,
          name: organization.name || "Organization",
        },
        resetToken,
        resetUrl
      );
    } catch (error) {
      console.error("Error sending password reset email:", error);
      // Don't throw error - still return success to prevent email enumeration
    }

    res.status(200).json({
      success: true,
      message: "If the email exists, a password reset link has been sent.",
    });
  }
);

/**
 * Reset Password - Sole Tutor
 */
export const resetPasswordSoleTutor = TryCatchFunction(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw new ErrorClass("Token and new password are required", 400);
  }

  // Hash the token from URL
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Find tutor with this token
  const tutor = await SoleTutor.findOne({
    where: { password_reset_token: hashedToken },
  });

  if (!tutor) {
    throw new ErrorClass(
      "Invalid or expired reset token. Please request a new password reset.",
      400
    );
  }

  // Hash new password
  const hashedPassword = authService.hashPassword(newPassword);

  // Update password and clear token
  await tutor.update({
    password: hashedPassword,
    password_reset_token: null,
  });

  res.status(200).json({
    success: true,
    message:
      "Password has been reset successfully. You can now login with your new password.",
  });
});

/**
 * Reset Password - Organization
 */
export const resetPasswordOrganization = TryCatchFunction(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw new ErrorClass("Token and new password are required", 400);
  }

  // Hash the token from URL
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Find organization with this token
  const organization = await Organization.findOne({
    where: { password_reset_token: hashedToken },
  });

  if (!organization) {
    throw new ErrorClass(
      "Invalid or expired reset token. Please request a new password reset.",
      400
    );
  }

  // Hash new password
  const hashedPassword = authService.hashPassword(newPassword);

  // Update password and clear token
  await organization.update({
    password: hashedPassword,
    password_reset_token: null,
  });

  res.status(200).json({
    success: true,
    message:
      "Password has been reset successfully. You can now login with your new password.",
  });
});

/**
 * Tutor Logout
 * POST /api/marketplace/logout
 * 
 * Since we're using stateless JWT tokens, logout is primarily handled client-side
 * by removing the token from storage. This endpoint provides a consistent API
 * for logout operations and can be used for future activity logging if needed.
 */
export const tutorLogout = TryCatchFunction(async (req, res) => {
  // Since we're using stateless JWT tokens, logout is handled client-side
  // by simply removing the token from storage
  // Future: Could add activity logging here if needed

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

