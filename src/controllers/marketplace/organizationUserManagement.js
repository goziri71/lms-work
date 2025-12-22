import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { OrganizationUser } from "../../models/marketplace/organizationUser.js";
import { Organization } from "../../models/marketplace/organization.js";
import { authService } from "../../service/authservice.js";
import { Op } from "sequelize";

/**
 * Get all organization users
 * GET /api/marketplace/tutor/organization/users
 * Only accessible by organization account (not organization_user)
 */
export const getOrganizationUsers = TryCatchFunction(async (req, res) => {
  const organization = req.tutor;
  const userType = req.user.userType;

  // Only organization account can manage users, not organization_user
  if (userType !== "organization") {
    throw new ErrorClass("Only organization account can manage users", 403);
  }

  const {
    page = 1,
    limit = 20,
    role,
    status,
    search,
  } = req.query;

  const where = {
    organization_id: organization.id,
  };

  if (role) {
    where.role = role;
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where[Op.or] = [
      { fname: { [Op.iLike]: `%${search}%` } },
      { lname: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows: users } = await OrganizationUser.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    attributes: {
      exclude: ["password", "password_reset_token"],
    },
    order: [["created_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Organization users retrieved successfully",
    data: {
      users,
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
 * Get single organization user
 * GET /api/marketplace/tutor/organization/users/:id
 */
export const getOrganizationUserById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const organization = req.tutor;
  const userType = req.user.userType;

  if (userType !== "organization") {
    throw new ErrorClass("Only organization account can view users", 403);
  }

  const user = await OrganizationUser.findOne({
    where: {
      id,
      organization_id: organization.id,
    },
    attributes: {
      exclude: ["password", "password_reset_token"],
    },
  });

  if (!user) {
    throw new ErrorClass("Organization user not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Organization user retrieved successfully",
    data: {
      user,
    },
  });
});

/**
 * Create organization user
 * POST /api/marketplace/tutor/organization/users
 */
export const createOrganizationUser = TryCatchFunction(async (req, res) => {
  const organization = req.tutor;
  const userType = req.user.userType;

  if (userType !== "organization") {
    throw new ErrorClass("Only organization account can create users", 403);
  }

  const {
    email,
    password,
    fname,
    lname,
    mname,
    phone,
    role = "tutor",
    bio,
    specialization,
    qualifications,
    experience_years,
  } = req.body;

  // Validation
  if (!email || !password || !fname || !lname) {
    throw new ErrorClass("Email, password, first name, and last name are required", 400);
  }

  if (!["admin", "tutor", "manager"].includes(role)) {
    throw new ErrorClass("Invalid role. Must be 'admin', 'tutor', or 'manager'", 400);
  }

  // Check if email already exists
  const existingUser = await OrganizationUser.findOne({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw new ErrorClass("User with this email already exists", 409);
  }

  // Hash password
  const hashedPassword = authService.hashPassword(password);

  // Create user
  const user = await OrganizationUser.create({
    organization_id: organization.id,
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    fname: fname.trim(),
    lname: lname.trim(),
    mname: mname?.trim() || null,
    phone: phone?.trim() || null,
    role: role,
    bio: bio?.trim() || null,
    specialization: specialization?.trim() || null,
    qualifications: qualifications?.trim() || null,
    experience_years: experience_years || 0,
    status: "active",
  });

  res.status(201).json({
    success: true,
    message: "Organization user created successfully",
    data: {
      user: {
        id: user.id,
        email: user.email,
        fname: user.fname,
        lname: user.lname,
        role: user.role,
        status: user.status,
      },
    },
  });
});

/**
 * Update organization user
 * PUT /api/marketplace/tutor/organization/users/:id
 */
export const updateOrganizationUser = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const organization = req.tutor;
  const userType = req.user.userType;

  if (userType !== "organization") {
    throw new ErrorClass("Only organization account can update users", 403);
  }

  const user = await OrganizationUser.findOne({
    where: {
      id,
      organization_id: organization.id,
    },
  });

  if (!user) {
    throw new ErrorClass("Organization user not found", 404);
  }

  const {
    fname,
    lname,
    mname,
    phone,
    role,
    bio,
    specialization,
    qualifications,
    experience_years,
    status,
  } = req.body;

  const updateData = {};

  if (fname !== undefined) updateData.fname = fname.trim();
  if (lname !== undefined) updateData.lname = lname.trim();
  if (mname !== undefined) updateData.mname = mname?.trim() || null;
  if (phone !== undefined) updateData.phone = phone?.trim() || null;
  if (bio !== undefined) updateData.bio = bio?.trim() || null;
  if (specialization !== undefined) updateData.specialization = specialization?.trim() || null;
  if (qualifications !== undefined) updateData.qualifications = qualifications?.trim() || null;
  if (experience_years !== undefined) updateData.experience_years = experience_years || 0;

  if (role !== undefined) {
    if (!["admin", "tutor", "manager"].includes(role)) {
      throw new ErrorClass("Invalid role. Must be 'admin', 'tutor', or 'manager'", 400);
    }
    updateData.role = role;
  }

  if (status !== undefined) {
    if (!["active", "inactive", "suspended"].includes(status)) {
      throw new ErrorClass("Invalid status. Must be 'active', 'inactive', or 'suspended'", 400);
    }
    updateData.status = status;
  }

  // Validation
  if (fname !== undefined && !fname) {
    throw new ErrorClass("First name is required", 400);
  }
  if (lname !== undefined && !lname) {
    throw new ErrorClass("Last name is required", 400);
  }

  await user.update(updateData);

  // Reload to get updated data
  await user.reload();

  const userData = user.toJSON();
  delete userData.password;
  delete userData.password_reset_token;

  res.status(200).json({
    success: true,
    message: "Organization user updated successfully",
    data: {
      user: userData,
    },
  });
});

/**
 * Delete organization user
 * DELETE /api/marketplace/tutor/organization/users/:id
 */
export const deleteOrganizationUser = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const organization = req.tutor;
  const userType = req.user.userType;

  if (userType !== "organization") {
    throw new ErrorClass("Only organization account can delete users", 403);
  }

  const user = await OrganizationUser.findOne({
    where: {
      id,
      organization_id: organization.id,
    },
  });

  if (!user) {
    throw new ErrorClass("Organization user not found", 404);
  }

  await user.destroy();

  res.status(200).json({
    success: true,
    message: "Organization user deleted successfully",
  });
});

/**
 * Reset organization user password
 * POST /api/marketplace/tutor/organization/users/:id/reset-password
 */
export const resetOrganizationUserPassword = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const organization = req.tutor;
  const userType = req.user.userType;

  if (userType !== "organization") {
    throw new ErrorClass("Only organization account can reset user passwords", 403);
  }

  if (!newPassword) {
    throw new ErrorClass("New password is required", 400);
  }

  const user = await OrganizationUser.findOne({
    where: {
      id,
      organization_id: organization.id,
    },
  });

  if (!user) {
    throw new ErrorClass("Organization user not found", 404);
  }

  // Hash new password
  const hashedPassword = authService.hashPassword(newPassword);

  await user.update({
    password: hashedPassword,
    password_reset_token: null,
  });

  res.status(200).json({
    success: true,
    message: "Password reset successfully",
  });
});

/**
 * Get organization users statistics
 * GET /api/marketplace/tutor/organization/users/stats
 */
export const getOrganizationUsersStats = TryCatchFunction(async (req, res) => {
  const organization = req.tutor;
  const userType = req.user.userType;

  if (userType !== "organization") {
    throw new ErrorClass("Only organization account can view statistics", 403);
  }

  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    suspendedUsers,
    adminCount,
    tutorCount,
    managerCount,
  ] = await Promise.all([
    OrganizationUser.count({
      where: { organization_id: organization.id },
    }),
    OrganizationUser.count({
      where: { organization_id: organization.id, status: "active" },
    }),
    OrganizationUser.count({
      where: { organization_id: organization.id, status: "inactive" },
    }),
    OrganizationUser.count({
      where: { organization_id: organization.id, status: "suspended" },
    }),
    OrganizationUser.count({
      where: { organization_id: organization.id, role: "admin" },
    }),
    OrganizationUser.count({
      where: { organization_id: organization.id, role: "tutor" },
    }),
    OrganizationUser.count({
      where: { organization_id: organization.id, role: "manager" },
    }),
  ]);

  res.status(200).json({
    success: true,
    message: "Organization users statistics retrieved successfully",
    data: {
      total: totalUsers,
      by_status: {
        active: activeUsers,
        inactive: inactiveUsers,
        suspended: suspendedUsers,
      },
      by_role: {
        admin: adminCount,
        tutor: tutorCount,
        manager: managerCount,
      },
    },
  });
});

