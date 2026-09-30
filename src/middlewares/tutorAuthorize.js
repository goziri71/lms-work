import { authService } from "../service/authservice.js";
import { ErrorClass } from "../utils/errorClass/index.js";
import { Config } from "../config/config.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";
import { OrganizationUser } from "../models/marketplace/organizationUser.js";
import {
  resolveLinkedCreatorForStudentId,
  studentHasUnlinkedCreatorAccount,
} from "../utils/creatorStudentLink.js";

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

    let effectiveType = decoded.userType;
    let effectiveId = decoded.id;

    // Learner JWT: allow tutor routes when accounts were linked (same email + password at login)
    if (decoded.userType === "student") {
      const linked = await resolveLinkedCreatorForStudentId(decoded.id);
      if (linked) {
        effectiveType = linked.userType;
        effectiveId = linked.id;
        req.tutor = linked.tutor;
        req.user = {
          id: linked.id,
          userType: linked.userType,
          studentId: decoded.id,
          actingViaLinkedStudent: true,
        };
        return next();
      }
      const needsCreatorLogin = await studentHasUnlinkedCreatorAccount(
        decoded.email
      );
      if (needsCreatorLogin) {
        throw new ErrorClass(
          "You have a separate creator account. Log in at creator login with your creator password, or use the same password on learner login once to link accounts.",
          403
        );
      }
      throw new ErrorClass("Invalid user type for tutor access", 403);
    }

    if (
      effectiveType !== "sole_tutor" &&
      effectiveType !== "organization" &&
      effectiveType !== "organization_user"
    ) {
      throw new ErrorClass("Invalid user type for tutor access", 403);
    }

    // Load user based on type
    let tutor;
    if (effectiveType === "sole_tutor") {
      tutor = await SoleTutor.findByPk(effectiveId);
      if (!tutor || tutor.status !== "active") {
        throw new ErrorClass("Tutor account not found or inactive", 401);
      }
    } else if (effectiveType === "organization") {
      tutor = await Organization.findByPk(effectiveId);
      if (!tutor || tutor.status !== "active") {
        throw new ErrorClass("Organization account not found or inactive", 401);
      }
    } else if (effectiveType === "organization_user") {
      tutor = await OrganizationUser.findByPk(effectiveId, {
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
      id: effectiveId,
      userType: effectiveType,
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
