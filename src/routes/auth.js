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

const router = express.Router();

// Registration endpoints
router.post("/register/student", registerStudent);
router.post("/register/staff", registerStaff);

// Universal login (tries both student and staff)
router.post("/login", login);

// Specific login endpoints
router.post("/student/login", studentLogin);
router.post("/staff/login", staffLogin);

// Password reset endpoints
router.post("/password/reset-request", requestPasswordReset);
router.post("/password/reset", resetPassword);

// Refresh token endpoint - DISABLED (no longer using refresh tokens)
// router.post("/refresh", refreshToken);

// Profile endpoints (require authentication)
router.get("/profile", authorize, getProfile);
router.put("/profile/student", authorize, updateStudentProfile);
router.put("/profile/staff", authorize, updateStaffProfile);

// Change password endpoint (requires authentication)
router.post("/password/change", authorize, changeStudentPassword);

// Logout (requires authentication)
router.post("/logout", authorize, logout);

export default router;
