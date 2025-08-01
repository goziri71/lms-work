import { AuthService } from "../service/authservice.js";
import { Config } from "../config/config.js";

const authService = new AuthService();

export const authorize = async (req, res, next) => {
  try {
    const authHeader = req.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: false,
        message: "Authorization header missing or invalid format",
      });
    }

    const authToken = authHeader.split(" ")[1];
    const verifiedToken = await authService.verifyToken(
      authToken,
      Config.JWT_SECRET
    );

    req.user = verifiedToken.id;
    next();
  } catch (error) {
    res.status(401).json({
      status: false,
      message: error.message || "Invalid token",
    });
  }
};
