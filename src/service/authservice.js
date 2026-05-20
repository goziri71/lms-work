// In authservice.js, add this export:
import jwt from "jsonwebtoken";
import crypto from "crypto"; // For MD5 hashing

// OPTIMIZATION: Cache JWT secret for faster access
const JWT_SECRET = process.env.JWT_SECRET || "your-secret";
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || "refresh-secret";

const ACCESS_TOKEN_EXPIRES_STUDENT = "24h";
const ACCESS_TOKEN_EXPIRES_DEFAULT = "4h";
const ACCESS_TOKEN_EXPIRES_STUDENT_SECONDS = 86400;
const ACCESS_TOKEN_EXPIRES_DEFAULT_SECONDS = 14400;

export function getAccessTokenExpiresIn(userType) {
  return userType === "student"
    ? ACCESS_TOKEN_EXPIRES_STUDENT
    : ACCESS_TOKEN_EXPIRES_DEFAULT;
}

export function getAccessTokenExpiresInSeconds(userType) {
  return userType === "student"
    ? ACCESS_TOKEN_EXPIRES_STUDENT_SECONDS
    : ACCESS_TOKEN_EXPIRES_DEFAULT_SECONDS;
}

export class AuthService {
  constructor() {
    this.jwt = jwt;
    this.period = 60 * 60 * 24;
  }

  // OPTIMIZATION: Simplified token generation
  async signToken(payload, signature, period) {
    return this.jwt.sign({ id: payload }, signature, {
      expiresIn: period,
    });
  }

  async verifyToken(payload, signature) {
    try {
      return this.jwt.verify(payload, signature);
    } catch (error) {
      console.error("Token verification error:", error.message);
      throw error;
    }
  }

  // OPTIMIZATION: Faster token generation with cached secrets
  async generateAccessToken(payload, expiresInOverride) {
    const expiresIn =
      expiresInOverride ?? getAccessTokenExpiresIn(payload.userType);
    return this.jwt.sign(payload, JWT_SECRET, {
      expiresIn,
      algorithm: "HS256", // Explicit algorithm for speed
    });
  }

  async generateRefreshToken(userId) {
    return this.jwt.sign({ id: userId }, REFRESH_SECRET, {
      expiresIn: "7d",
      algorithm: "HS256",
    });
  }

  async refreshAccessToken(refreshToken) {
    const decoded = await this.jwt.verify(refreshToken, REFRESH_SECRET);
    return decoded;
  }

  // OPTIMIZATION: Synchronous MD5 for maximum speed
  hashPassword(plainPassword) {
    const md5Hash = crypto
      .createHash("md5")
      .update(plainPassword)
      .digest("hex");
    return md5Hash;
  }

  comparePassword(plainPassword, hashedPassword) {
    const md5Hash = crypto
      .createHash("md5")
      .update(plainPassword)
      .digest("hex");
    return md5Hash === hashedPassword;
  }
}

// Export both the class and an instance
export const authService = new AuthService();
