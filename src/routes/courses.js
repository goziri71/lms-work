import { Router } from "express";
import {
  getStudentCourses,
  getStaffCourses,
  getCourseById,
  getCourseParticipants,
  getMyCourseParticipants,
} from "../controllers/courses/courses.js";
import {
  getAvailableSemesters,
} from "../controllers/courses/courseRegistration.js";
import {
  getMyAllocatedCourses,
  registerAllocatedCourses,
} from "../controllers/student/courseAllocation.js";
import {
  getMySchoolFees,
  getMySchoolFeesHistory,
  verifySchoolFeesPayment,
  paySchoolFeesFromWallet,
} from "../controllers/student/schoolFees.js";
import {
  trackActivity,
  sendHeartbeat,
  trackBatch,
} from "../controllers/student/activityTracking.js";
import { authorize } from "../middlewares/authorize.js";

const router = Router();

// Query-based (backward compatible)
router.get("/student", authorize, getStudentCourses);
router.get("/staff", authorize, getStaffCourses);

// Param-based routes to avoid URL-encoding slashes in academicYear
// Examples:
// - /api/courses/student/2024/2025/1ST
// - /api/courses/student/2024/2025
router.get(
  "/student/:startYear/:endYear/:semester",
  authorize,
  getStudentCourses
);
router.get("/student/:startYear/:endYear", authorize, getStudentCourses);

// Example: /api/courses/staff/2024/2025 (optional ?semester=1ST&includeStudents=true)
router.get("/staff/:startYear/:endYear", authorize, getStaffCourses);

// Get one course by id (staff owner or student enrolled)
router.get("/single/:courseId", authorize, getCourseById);

// Student-accessible participants (lecturer + classmates) for a course
router.get("/:courseId/participants", authorize, getCourseParticipants);

// Student-accessible participants for ALL their enrolled courses (no courseId)
router.get("/participants", authorize, getMyCourseParticipants);

// Course registration endpoints (removed - students only use allocated courses)
// router.post("/register", authorize, registerCourse); // REMOVED - use /register-allocated instead
// router.delete("/register/:registrationId", authorize, unregisterCourse); // REMOVED
// router.get("/available", authorize, getAvailableCourses); // REMOVED - use /allocated instead
router.get("/semesters", authorize, getAvailableSemesters);

// Course allocation endpoints (for allocated courses)
router.get("/allocated", authorize, getMyAllocatedCourses);
router.post("/register-allocated", authorize, registerAllocatedCourses);

// School fees endpoints (student)
router.get("/school-fees", authorize, getMySchoolFees);
router.get("/school-fees/history", authorize, getMySchoolFeesHistory);
router.post("/school-fees/verify", authorize, verifySchoolFeesPayment);
router.post("/school-fees/pay-from-wallet", authorize, paySchoolFeesFromWallet);

// Activity tracking endpoints (student) - for frontend tracking
router.post("/activity/track", authorize, trackActivity);
router.post("/activity/heartbeat", authorize, sendHeartbeat);
router.post("/activity/batch", authorize, trackBatch);

export default router;
