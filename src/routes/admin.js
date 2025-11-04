import express from "express";
import {
  adminLogin,
  adminLogout,
  getAdminProfile,
  updateAdminProfile,
  requestAdminPasswordReset,
  resetAdminPassword,
} from "../controllers/admin/adminAuth.js";
import {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deactivateStudent,
  activateStudent,
  resetStudentPassword,
  getStudentStats,
} from "../controllers/admin/superAdmin/studentManagement.js";
import {
  getAllStaff,
  createStaff,
  updateStaff,
  deactivateStaff,
  resetStaffPassword,
} from "../controllers/admin/superAdmin/staffManagement.js";
import {
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deactivateAdmin,
  getAdminActivityLogs,
} from "../controllers/admin/superAdmin/adminManagement.js";
import {
  adminAuthorize,
  requireSuperAdmin,
  requirePermission,
} from "../middlewares/adminAuthorize.js";

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication)
// ============================================
router.post("/login", adminLogin);
router.post("/password/reset-request", requestAdminPasswordReset);
router.post("/password/reset", resetAdminPassword);

// ============================================
// AUTHENTICATED ADMIN ROUTES
// ============================================
router.use(adminAuthorize); // All routes below require admin authentication

// Admin Profile
router.get("/profile", getAdminProfile);
router.put("/profile", updateAdminProfile);
router.post("/logout", adminLogout);

// ============================================
// STUDENT MANAGEMENT
// ============================================
router.get("/students", getAllStudents);
router.get("/students/stats", getStudentStats);
router.get("/students/:id", getStudentById);

// Super Admin or permission required for modifications
router.post("/students", requirePermission("students", "create"), createStudent);
router.put("/students/:id", requirePermission("students", "edit"), updateStudent);
router.patch(
  "/students/:id/deactivate",
  requirePermission("students", "delete"),
  deactivateStudent
);
router.patch(
  "/students/:id/activate",
  requirePermission("students", "edit"),
  activateStudent
);
router.post(
  "/students/:id/reset-password",
  requirePermission("students", "edit"),
  resetStudentPassword
);

// ============================================
// STAFF MANAGEMENT
// ============================================
router.get("/staff", getAllStaff);
router.post("/staff", requirePermission("staff", "create"), createStaff);
router.put("/staff/:id", requirePermission("staff", "edit"), updateStaff);
router.patch(
  "/staff/:id/deactivate",
  requirePermission("staff", "delete"),
  deactivateStaff
);
router.post(
  "/staff/:id/reset-password",
  requirePermission("staff", "edit"),
  resetStaffPassword
);

// ============================================
// ADMIN MANAGEMENT (Super Admin Only)
// ============================================
router.get("/admins", requireSuperAdmin, getAllAdmins);
router.post("/admins", requireSuperAdmin, createAdmin);
router.put("/admins/:id", requireSuperAdmin, updateAdmin);
router.patch("/admins/:id/deactivate", requireSuperAdmin, deactivateAdmin);
router.get("/activity-logs", requireSuperAdmin, getAdminActivityLogs);

// ============================================
// DASHBOARD & ANALYTICS
// ============================================
// TODO: Add dashboard routes
// router.get("/dashboard/stats", getDashboardStats);
// router.get("/analytics/students", getStudentAnalytics);
// router.get("/analytics/courses", getCourseAnalytics);

export default router;

