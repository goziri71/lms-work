import { Op } from "sequelize";
import { db } from "../database/database.js";

/**
 * Middleware to add data isolation filters based on user type
 * Ensures users only see their own data (unless Super Admin)
 */
export const addDataIsolation = (req, res, next) => {
  // Super Admin can see everything (no filtering)
  if (req.user?.userType === "admin" && req.user?.role === "super_admin") {
    req.dataIsolation = null; // No filtering
    return next();
  }

  // WPU Admin - can see WPU data only
  if (req.user?.userType === "admin") {
    req.dataIsolation = {
      owner_type: { [Op.in]: ["wpu", "wsp"] }, // Support both wpu and legacy wsp
      owner_id: null,
    };
    return next();
  }

  // Sole Tutor - can only see their own data
  if (req.user?.userType === "sole_tutor") {
    req.dataIsolation = {
      owner_type: "sole_tutor",
      owner_id: req.user.id,
    };
    return next();
  }

  // Organization - can see their organization's data
  if (req.user?.userType === "organization") {
    req.dataIsolation = {
      owner_type: "organization",
      owner_id: req.user.id,
    };
    return next();
  }

  // Organization User - can see their organization's data
  if (req.user?.userType === "organization_user") {
    req.dataIsolation = {
      owner_type: "organization",
      owner_id: req.user.organizationId,
    };
    return next();
  }

  // Staff/Student - can only see WPU data
  if (req.user?.userType === "staff" || req.user?.userType === "student") {
    req.dataIsolation = {
      owner_type: { [Op.in]: ["wpu", "wsp"] }, // Support both wpu and legacy wsp
      owner_id: null,
    };
    return next();
  }

  // Default: no access
  req.dataIsolation = null;
  next();
};

/**
 * Helper function to build where clause with data isolation
 */
export const buildIsolatedWhere = (baseWhere = {}, req) => {
  if (!req.dataIsolation) {
    return baseWhere; // Super Admin - no filtering
  }

  return {
    ...baseWhere,
    owner_type: req.dataIsolation.owner_type,
    ...(req.dataIsolation.owner_id !== null && {
      owner_id: req.dataIsolation.owner_id,
    }),
  };
};

