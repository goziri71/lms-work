import express from "express";
import {
  login,
  studentLogin,
  staffLogin,
  logout,
} from "../controllers/auth/auth.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// Universal login (tries both student and staff)
router.post("/login", login);

// Specific login endpoints
router.post("/student/login", studentLogin);
router.post("/staff/login", staffLogin);

// Refresh token endpoint - DISABLED (no longer using refresh tokens)
// router.post("/refresh", refreshToken);

// Logout (requires authentication)
router.post("/logout", authorize, logout);

export default router;
