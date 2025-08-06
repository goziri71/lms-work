// In authservice.js, add this export:
import jwt from "jsonwebtoken";
import crypto from "crypto"; // For MD5 hashing

export class AuthService {
  constructor() {
    this.jwt = jwt;
    this.period = 60 * 60 * 24;
  }

  async signToken(payload, signature, period) {
    const token = await this.jwt.sign({ id: payload }, signature, {
      expiresIn: period,
    });
    return token;
  }

  async verifyToken(payload, signature) {
    const verified = await this.jwt.verify(payload, signature);
    return verified;
  }

  // Add the missing methods that your login controller expects:
  async generateAccessToken(payload) {
    return this.signToken(
      payload,
      process.env.JWT_SECRET || "your-secret",
      "15m"
    );
  }

  async generateRefreshToken(userId) {
    return this.signToken(
      userId,
      process.env.REFRESH_TOKEN_SECRET || "refresh-secret",
      "7d"
    );
  }

  async refreshAccessToken(refreshToken) {
    const decoded = await this.verifyToken(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET || "refresh-secret"
    );
    return this.generateAccessToken(decoded);
  }

  // MD5 password comparison (since your database uses MD5)
  async comparePassword(plainPassword, hashedPassword) {
    const md5Hash = crypto
      .createHash("md5")
      .update(plainPassword)
      .digest("hex");
    return md5Hash === hashedPassword;
  }
}

// Export both the class and an instance
export const authService = new AuthService();
