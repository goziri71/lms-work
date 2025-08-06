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
    console.log(verifiedToken);
    req.user = verifiedToken.id;
    next();
  } catch (error) {
    res.status(401).json({
      status: false,
      message: error.message,
    });
  }
};
