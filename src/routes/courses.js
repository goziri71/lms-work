import { Router } from "express";
import {
  getStudentCourses,
  getStaffCourses,
  getCourseById,
  getCourseParticipants,
  getMyCourseParticipants,
} from "../controllers/courses/courses.js";
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

export default router;
