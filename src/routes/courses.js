import { Router } from "express";
import {
  getStudentCourses,
  getStaffCourses,
  getCourseById,
  getCourseParticipants,
  getMyCourseParticipants,
} from "../controllers/courses/courses.js";
import {
  registerCourse,
  unregisterCourse,
  getAvailableSemesters,
  getAvailableCourses,
} from "../controllers/courses/courseRegistration.js";
import {
  getMyAllocatedCourses,
  registerAllocatedCourses,
} from "../controllers/student/courseAllocation.js";
import {
  getMySchoolFees,
  paySchoolFees,
} from "../controllers/student/schoolFees.js";
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

// Course registration endpoints
router.post("/register", authorize, registerCourse);
router.delete("/register/:registrationId", authorize, unregisterCourse);
router.get("/semesters", authorize, getAvailableSemesters);
router.get("/available", authorize, getAvailableCourses);

// Course allocation endpoints (for allocated courses)
router.get("/allocated", authorize, getMyAllocatedCourses);
router.post("/register-allocated", authorize, registerAllocatedCourses);

// School fees endpoints (student)
router.get("/school-fees", authorize, getMySchoolFees);
router.post("/school-fees/pay", authorize, paySchoolFees);

export default router;
