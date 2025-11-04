import jwt from "jsonwebtoken";
import { ErrorClass } from "../utils/errorClass/index.js";
import { WspAdmin } from "../models/admin/wspAdmin.js";

/**
 * Middleware to authorize admin users
 * Checks if user is authenticated AND is an admin
 */
export const adminAuthorize = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ErrorClass("No token provided. Admin authentication required.", 401);
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user type is admin
    if (decoded.userType !== "admin") {
      throw new ErrorClass("Access denied. Admin privileges required.", 403);
    }

    // Verify admin still exists and is active
    const admin = await WspAdmin.findByPk(decoded.id);

    if (!admin) {
      throw new ErrorClass("Admin account not found", 401);
    }

    if (admin.status !== "active") {
      throw new ErrorClass(
        `Admin account is ${admin.status}. Access denied.`,
        403
      );
    }

    // Attach admin info to request
    req.user = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      userType: "admin",
      permissions: admin.permissions,
      firstName: admin.fname,
      lastName: admin.lname,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Authentication failed",
    });
  }
};

/**
 * Middleware to check if admin is Super Admin
 * Use after adminAuthorize middleware
 */
export const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Super Admin privileges required.",
    });
  }
  next();
};

/**
 * Middleware to check specific permission
 * Use after adminAuthorize middleware
 * 
 * @param {string} resource - The resource to check (e.g., 'students', 'courses')
 * @param {string} action - The action to check (e.g., 'create', 'edit', 'delete')
 */
export const requirePermission = (resource, action) => {
  return (req, res, next) => {
    const { role, permissions } = req.user;

    // Super admins have all permissions
    if (role === "super_admin") {
      return next();
    }

    // Check if admin has specific permission
    if (permissions && permissions[resource] && permissions[resource][action]) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. You don't have permission to ${action} ${resource}.`,
    });
  };
};

/**
 * Helper function to log admin actions
 * Use in controllers after successful operations
 */
export const logAdminActivity = async (adminId, action, targetType, targetId, description, metadata = {}) => {
  try {
    const { AdminActivityLog } = await import("../models/admin/adminActivityLog.js");
    
    await AdminActivityLog.create({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      description,
      metadata,
      result: "success",
    });
  } catch (error) {
    console.error("Error logging admin activity:", error);
    // Don't throw error - logging failure shouldn't break the operation
  }
};

