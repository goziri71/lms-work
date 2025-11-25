import { SoleTutor } from "../../../models/marketplace/soleTutor.js";
import { Organization } from "../../../models/marketplace/organization.js";
import { OrganizationUser } from "../../../models/marketplace/organizationUser.js";
import { Courses } from "../../../models/course/courses.js";
import { db } from "../../../database/database.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";
import { emailService } from "../../../services/emailService.js";
import { EmailLog } from "../../../models/email/emailLog.js";

/**
 * Get all sole tutors
 */
export const getAllSoleTutors = TryCatchFunction(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    verification_status,
    search,
  } = req.query;

  const where = {};
  if (status) where.status = status;
  if (verification_status) where.verification_status = verification_status;
  if (search) {
    where[db.Sequelize.Op.or] = [
      { fname: { [db.Sequelize.Op.iLike]: `%${search}%` } },
      { lname: { [db.Sequelize.Op.iLike]: `%${search}%` } },
      { email: { [db.Sequelize.Op.iLike]: `%${search}%` } },
      { specialization: { [db.Sequelize.Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows: tutors } = await SoleTutor.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    attributes: {
      exclude: ["password", "password_reset_token", "verification_documents"],
    },
    order: [["id", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Sole tutors retrieved successfully",
    data: {
      tutors,
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
 * Get single sole tutor with courses
 */
export const getSoleTutorById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const tutor = await SoleTutor.findByPk(id, {
    attributes: {
      exclude: ["password", "password_reset_token", "verification_documents"],
    },
    include: [
      {
        model: Courses,
        as: "courses",
        attributes: [
          "id",
          "title",
          "course_code",
          "price",
          "is_marketplace",
          "marketplace_status",
        ],
      },
    ],
  });

  if (!tutor) {
    throw new ErrorClass("Sole tutor not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Sole tutor retrieved successfully",
    data: {
      tutor,
      courseCount: tutor.courses?.length || 0,
    },
  });
});

/**
 * Approve sole tutor
 */
export const approveSoleTutor = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const tutor = await SoleTutor.findByPk(id);
  if (!tutor) {
    throw new ErrorClass("Sole tutor not found", 404);
  }

  if (tutor.status === "active") {
    throw new ErrorClass("Tutor is already approved", 400);
  }

  tutor.status = "active";
  await tutor.save();

  // Send approval email
  try {
    await emailService.sendEmail({
      to: tutor.email,
      name: `${tutor.fname} ${tutor.lname}`,
      subject: "Your Tutor Account Has Been Approved",
      htmlBody: `<div><h2>Account Approved</h2><p>Dear ${tutor.fname} ${tutor.lname},</p><p>Your tutor account has been approved! You can now log in and start creating courses.</p><p>Welcome to the marketplace!</p></div>`,
    });

    await EmailLog.create({
      recipient_email: tutor.email,
      recipient_type: "sole_tutor",
      recipient_id: tutor.id,
      email_type: "welcome",
      subject: "Your Tutor Account Has Been Approved",
      status: "sent",
    });
  } catch (emailError) {
    console.error("Error sending approval email:", emailError);
  }

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "approved_sole_tutor", "sole_tutor", id, {
        tutor_email: tutor.email,
      });
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Sole tutor approved successfully",
    data: {
      tutor: {
        id: tutor.id,
        email: tutor.email,
        status: tutor.status,
      },
    },
  });
});

/**
 * Reject sole tutor
 */
export const rejectSoleTutor = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const tutor = await SoleTutor.findByPk(id);
  if (!tutor) {
    throw new ErrorClass("Sole tutor not found", 404);
  }

  tutor.status = "rejected";
  await tutor.save();

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "rejected_sole_tutor", "sole_tutor", id, {
        tutor_email: tutor.email,
        reason: reason || null,
      });
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Sole tutor rejected successfully",
    data: {
      tutor: {
        id: tutor.id,
        email: tutor.email,
        status: tutor.status,
      },
    },
  });
});

/**
 * Suspend/Activate sole tutor
 */
export const updateSoleTutorStatus = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["active", "suspended"].includes(status)) {
    throw new ErrorClass("Invalid status. Must be 'active' or 'suspended'", 400);
  }

  const tutor = await SoleTutor.findByPk(id);
  if (!tutor) {
    throw new ErrorClass("Sole tutor not found", 404);
  }

  const oldStatus = tutor.status;
  tutor.status = status;
  await tutor.save();

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "updated_sole_tutor_status", "sole_tutor", id, {
        old_status: oldStatus,
        new_status: status,
      });
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: `Sole tutor ${status === "active" ? "activated" : "suspended"} successfully`,
    data: {
      tutor: {
        id: tutor.id,
        email: tutor.email,
        status: tutor.status,
      },
    },
  });
});

/**
 * Get all organizations
 */
export const getAllOrganizations = TryCatchFunction(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    verification_status,
    search,
  } = req.query;

  const where = {};
  if (status) where.status = status;
  if (verification_status) where.verification_status = verification_status;
  if (search) {
    where[db.Sequelize.Op.or] = [
      { name: { [db.Sequelize.Op.iLike]: `%${search}%` } },
      { email: { [db.Sequelize.Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows: organizations } = await Organization.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    attributes: {
      exclude: ["password", "password_reset_token", "verification_documents"],
    },
    include: [
      {
        model: OrganizationUser,
        as: "users",
        attributes: ["id", "fname", "lname", "email", "role", "status"],
        required: false,
      },
    ],
    order: [["id", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Organizations retrieved successfully",
    data: {
      organizations,
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
 * Get single organization with users and courses
 */
export const getOrganizationById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const organization = await Organization.findByPk(id, {
    attributes: {
      exclude: ["password", "password_reset_token", "verification_documents"],
    },
    include: [
      {
        model: OrganizationUser,
        as: "users",
        attributes: {
          exclude: ["password", "password_reset_token"],
        },
      },
      {
        model: Courses,
        as: "courses",
        attributes: [
          "id",
          "title",
          "course_code",
          "price",
          "is_marketplace",
          "marketplace_status",
        ],
      },
    ],
  });

  if (!organization) {
    throw new ErrorClass("Organization not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Organization retrieved successfully",
    data: {
      organization,
      userCount: organization.users?.length || 0,
      courseCount: organization.courses?.length || 0,
    },
  });
});

/**
 * Approve organization
 */
export const approveOrganization = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const organization = await Organization.findByPk(id);
  if (!organization) {
    throw new ErrorClass("Organization not found", 404);
  }

  if (organization.status === "active") {
    throw new ErrorClass("Organization is already approved", 400);
  }

  organization.status = "active";
  await organization.save();

  // Send approval email
  try {
    await emailService.sendEmail({
      to: organization.email,
      name: organization.name,
      subject: "Your Organization Account Has Been Approved",
      htmlBody: `<div><h2>Account Approved</h2><p>Dear ${organization.name},</p><p>Your organization account has been approved! You can now log in and start managing your tutors and courses.</p><p>Welcome to the marketplace!</p></div>`,
    });

    await EmailLog.create({
      recipient_email: organization.email,
      recipient_type: "organization",
      recipient_id: organization.id,
      email_type: "welcome",
      subject: "Your Organization Account Has Been Approved",
      status: "sent",
    });
  } catch (emailError) {
    console.error("Error sending approval email:", emailError);
  }

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "approved_organization",
        "organization",
        id,
        {
          organization_name: organization.name,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Organization approved successfully",
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
 * Reject organization
 */
export const rejectOrganization = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const organization = await Organization.findByPk(id);
  if (!organization) {
    throw new ErrorClass("Organization not found", 404);
  }

  organization.status = "rejected";
  await organization.save();

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "rejected_organization",
        "organization",
        id,
        {
          organization_name: organization.name,
          reason: reason || null,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Organization rejected successfully",
    data: {
      organization: {
        id: organization.id,
        name: organization.name,
        status: organization.status,
      },
    },
  });
});

/**
 * Suspend/Activate organization
 */
export const updateOrganizationStatus = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["active", "suspended"].includes(status)) {
    throw new ErrorClass("Invalid status. Must be 'active' or 'suspended'", 400);
  }

  const organization = await Organization.findByPk(id);
  if (!organization) {
    throw new ErrorClass("Organization not found", 404);
  }

  const oldStatus = organization.status;
  organization.status = status;
  await organization.save();

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "updated_organization_status",
        "organization",
        id,
        {
          old_status: oldStatus,
          new_status: status,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: `Organization ${status === "active" ? "activated" : "suspended"} successfully`,
    data: {
      organization: {
        id: organization.id,
        name: organization.name,
        status: organization.status,
      },
    },
  });
});

/**
 * Get tutor statistics
 */
export const getTutorStats = TryCatchFunction(async (req, res) => {
  const [
    totalSoleTutors,
    activeSoleTutors,
    pendingSoleTutors,
    totalOrganizations,
    activeOrganizations,
    pendingOrganizations,
  ] = await Promise.all([
    SoleTutor.count(),
    SoleTutor.count({ where: { status: "active" } }),
    SoleTutor.count({ where: { status: "pending" } }),
    Organization.count(),
    Organization.count({ where: { status: "active" } }),
    Organization.count({ where: { status: "pending" } }),
  ]);

  // Tutor courses count
  const tutorCoursesCount = await Courses.count({
    where: {
      owner_type: { [db.Sequelize.Op.in]: ["sole_tutor", "organization"] },
    },
  });

  res.status(200).json({
    success: true,
    message: "Tutor statistics retrieved successfully",
    data: {
      soleTutors: {
        total: totalSoleTutors,
        active: activeSoleTutors,
        pending: pendingSoleTutors,
      },
      organizations: {
        total: totalOrganizations,
        active: activeOrganizations,
        pending: pendingOrganizations,
      },
      tutorCourses: tutorCoursesCount,
    },
  });
});

