import express from "express";
import {
  login,
  studentLogin,
  staffLogin,
  logout,
  getProfile,
  updateStudentProfile,
  updateStaffProfile,
  registerStudent,
  registerStaff,
  requestPasswordReset,
  resetPassword,
  changeStudentPassword,
} from "../controllers/auth/auth.js";
import { authorize } from "../middlewares/authorize.js";
import { authLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

// Registration endpoints
router.post("/register/student", registerStudent);
router.post("/register/staff", registerStaff);

// Universal login (tries both student and staff)
router.post("/login", authLimiter, login);

// Specific login endpoints
router.post("/student/login", authLimiter, studentLogin);
router.post("/staff/login", authLimiter, staffLogin);

// Password reset endpoints
router.post("/password/reset-request", authLimiter, requestPasswordReset);
router.post("/password/reset", authLimiter, resetPassword);

// Refresh token endpoint - DISABLED (no longer using refresh tokens)
// router.post("/refresh", refreshToken);

// Profile endpoints (require authentication)
router.get("/profile", authorize, getProfile);
router.put("/profile/student", authorize, updateStudentProfile);
router.put("/profile/staff", authorize, updateStaffProfile);

// Change password endpoint (requires authentication)
router.post("/password/change", authorize, authLimiter, changeStudentPassword);

// Logout (requires authentication)
router.post("/logout", authorize, logout);

export default router;
