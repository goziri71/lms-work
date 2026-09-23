// In authservice.js, add this export:
import jwt from "jsonwebtoken";
import crypto from "crypto"; // Only used to detect/verify legacy MD5 hashes
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 12;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  throw new Error(
    "JWT_SECRET and REFRESH_TOKEN_SECRET must be set in the environment. Refusing to start with insecure fallback secrets.",
  );
}

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;

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

  hashPassword(plainPassword) {
    return bcrypt.hashSync(plainPassword, BCRYPT_ROUNDS);
  }

  isLegacyHash(hashedPassword) {
    return !BCRYPT_HASH_PATTERN.test(hashedPassword || "");
  }

  comparePassword(plainPassword, hashedPassword) {
    if (!hashedPassword) return false;
    if (this.isLegacyHash(hashedPassword)) {
      // Legacy accounts hashed with unsalted MD5 before the bcrypt migration.
      const md5Hash = crypto
        .createHash("md5")
        .update(plainPassword)
        .digest("hex");
      return md5Hash === hashedPassword;
    }
    return bcrypt.compareSync(plainPassword, hashedPassword);
  }

  // Verifies a password against a Sequelize instance and transparently
  // upgrades legacy MD5 hashes to bcrypt on successful login, so passwords
  // migrate off MD5 without forcing a mass password reset.
  async verifyAndUpgradePassword(plainPassword, instance, field = "password") {
    const storedHash = instance?.[field];
    const isValid = this.comparePassword(plainPassword, storedHash);
    if (isValid && this.isLegacyHash(storedHash)) {
      try {
        await instance.update({ [field]: this.hashPassword(plainPassword) });
      } catch (error) {
        console.error("Password rehash migration failed:", error.message);
      }
    }
    return isValid;
  }
}

// Export both the class and an instance
export const authService = new AuthService();
