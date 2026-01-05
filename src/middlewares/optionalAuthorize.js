import { AuthService } from "../service/authservice.js";
import { Config } from "./../config/config.js";

const authService = new AuthService();

/**
 * Optional authentication middleware
 * If token is provided and valid, sets req.user
 * If no token or invalid token, continues without req.user (doesn't throw error)
 */
export const optionalAuthorize = async (req, res, next) => {
  try {
    const authToken = req.get("Authorization")?.split(" ")[1];
    
    if (!authToken) {
      // No token provided - continue as public user
      req.user = null;
      return next();
    }

    try {
      const verifiedToken = await authService.verifyToken(
        authToken,
        Config.JWT_SECRET
      );
      req.user = verifiedToken; // Store full token payload
    } catch (tokenError) {
      // Invalid token - continue as public user (don't throw error)
      req.user = null;
    }
    
    next();
  } catch (error) {
    // Any other error - continue as public user
    req.user = null;
    next();
  }
};

