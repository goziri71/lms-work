import { AuthService } from "../service/authservice.js";
import { Config } from "./../config/config.js";

const authService = new AuthService();

export const authorize = async (req, res, next) => {
  try {
    const authToken = req.get("Authorization")?.split(" ")[1];
    const verifiedToken = await authService.verifyToken(
      authToken,
      Config.JWT_SECRET
    );
    req.user = verifiedToken; // Store full token payload, not just id
    next();
  } catch (error) {
    console.error("Authorization error:", error.message);
    res.status(401).json({
      status: false,
      message: error.message,
    });
  }
};
