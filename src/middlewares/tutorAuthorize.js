import { authService } from "../service/authservice.js";
import { ErrorClass } from "../utils/errorClass/index.js";
import { Config } from "../config/config.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";
import { OrganizationUser } from "../models/marketplace/organizationUser.js";

/**
 * Middleware to authenticate tutor (sole tutor, organization, or org user)
 */
export const tutorAuthorize = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      throw new ErrorClass("Authentication token required", 401);
    }

    const decoded = await authService.verifyToken(token, Config.JWT_SECRET);

    // Check user type
    if (
      decoded.userType !== "sole_tutor" &&
      decoded.userType !== "organization" &&
      decoded.userType !== "organization_user"
    ) {
      throw new ErrorClass("Invalid user type for tutor access", 403);
    }

    // Load user based on type
    let tutor;
    if (decoded.userType === "sole_tutor") {
      tutor = await SoleTutor.findByPk(decoded.id);
      if (!tutor || tutor.status !== "active") {
        throw new ErrorClass("Tutor account not found or inactive", 401);
      }
    } else if (decoded.userType === "organization") {
      tutor = await Organization.findByPk(decoded.id);
      if (!tutor || tutor.status !== "active") {
        throw new ErrorClass("Organization account not found or inactive", 401);
      }
    } else if (decoded.userType === "organization_user") {
      tutor = await OrganizationUser.findByPk(decoded.id, {
        include: [
          {
            model: Organization,
            as: "organization",
            attributes: ["id", "name", "status"],
          },
        ],
      });
      if (!tutor || tutor.status !== "active") {
        throw new ErrorClass("User account not found or inactive", 401);
      }
      if (tutor.organization.status !== "active") {
        throw new ErrorClass("Organization account is not active", 403);
      }
    }

    // Attach tutor to request
    req.tutor = tutor;
    req.user = {
      id: decoded.id,
      userType: decoded.userType,
      ...(decoded.organizationId && { organizationId: decoded.organizationId }),
    };

    next();
  } catch (error) {
    if (error instanceof ErrorClass) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

/**
 * Middleware to require sole tutor
 */
export const requireSoleTutor = (req, res, next) => {
  if (req.user?.userType !== "sole_tutor") {
    return res.status(403).json({
      success: false,
      message: "Access restricted to sole tutors only",
    });
  }
  next();
};

/**
 * Middleware to require organization
 */
export const requireOrganization = (req, res, next) => {
  if (req.user?.userType !== "organization") {
    return res.status(403).json({
      success: false,
      message: "Access restricted to organizations only",
    });
  }
  next();
};

/**
 * Middleware to require organization admin
 */
export const requireOrgAdmin = (req, res, next) => {
  if (req.user?.userType !== "organization_user") {
    return res.status(403).json({
      success: false,
      message: "Access restricted to organization users",
    });
  }
  if (req.tutor.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access restricted to organization admins only",
    });
  }
  next();
};
