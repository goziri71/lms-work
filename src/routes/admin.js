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
  getAllPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
  getProgramStats,
} from "../controllers/admin/superAdmin/programManagement.js";
import {
  getAllCourses,
  getCoursesByProgram,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseStats,
} from "../controllers/admin/superAdmin/courseManagement.js";
import {
  getAllSemesters,
  getSemesterById,
  getCurrentSemester,
  createSemester,
  updateSemester,
  closeSemester,
  extendSemester,
  activateSemester,
  deleteSemester,
  getSemesterStats,
} from "../controllers/admin/superAdmin/semesterManagement.js";
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
// PROGRAM MANAGEMENT (Super Admin Only)
// ============================================
router.get("/programs", requireSuperAdmin, getAllPrograms);
router.get("/programs/stats", requireSuperAdmin, getProgramStats);
router.get("/programs/:id", requireSuperAdmin, getProgramById);
router.post("/programs", requireSuperAdmin, createProgram);
router.put("/programs/:id", requireSuperAdmin, updateProgram);
router.delete("/programs/:id", requireSuperAdmin, deleteProgram);

// ============================================
// COURSE MANAGEMENT (Super Admin Only)
// ============================================
router.get("/courses", requireSuperAdmin, getAllCourses);
router.get("/courses/stats", requireSuperAdmin, getCourseStats);
router.get("/courses/program/:programId", requireSuperAdmin, getCoursesByProgram);
router.get("/courses/:id", requireSuperAdmin, getCourseById);
router.post("/courses", requireSuperAdmin, createCourse);
router.put("/courses/:id", requireSuperAdmin, updateCourse);
router.delete("/courses/:id", requireSuperAdmin, deleteCourse);

// ============================================
// SEMESTER MANAGEMENT (Super Admin Only)
// ============================================
router.get("/semesters", requireSuperAdmin, getAllSemesters);
router.get("/semesters/current", requireSuperAdmin, getCurrentSemester);
router.get("/semesters/stats", requireSuperAdmin, getSemesterStats);
router.get("/semesters/:id", requireSuperAdmin, getSemesterById);
router.post("/semesters", requireSuperAdmin, createSemester);
router.put("/semesters/:id", requireSuperAdmin, updateSemester);
router.patch("/semesters/:id/close", requireSuperAdmin, closeSemester);
router.patch("/semesters/:id/extend", requireSuperAdmin, extendSemester);
router.patch("/semesters/:id/activate", requireSuperAdmin, activateSemester);
router.delete("/semesters/:id", requireSuperAdmin, deleteSemester);

// ============================================
// DASHBOARD & ANALYTICS
// ============================================
// TODO: Add dashboard routes
// router.get("/dashboard/stats", getDashboardStats);
// router.get("/analytics/students", getStudentAnalytics);
// router.get("/analytics/courses", getCourseAnalytics);

export default router;

