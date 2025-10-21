import express from "express";
import {
  createExam,
  getStaffExams,
  getExamById,
  updateExam,
  deleteExam,
  getBankQuestions,
} from "../controllers/exam/examController.js";
import {
  createObjectiveQuestion,
  createTheoryQuestion,
  updateObjectiveQuestion,
  updateTheoryQuestion,
  deleteQuestion,
  getQuestionById,
} from "../controllers/exam/questionBankController.js";
import {
  getStudentExams,
  startExam,
  submitAnswer,
  submitExam,
  getAttemptDetails,
} from "../controllers/exam/studentExamController.js";
import {
  getExamAttempts,
  getAttemptForGrading,
  gradeTheoryAnswer,
  bulkGradeTheory,
  getExamStatistics,
} from "../controllers/exam/gradingController.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// ==================== STAFF ROUTES ====================
// Exam Management
router.post("/", authorize, createExam); // Create exam
router.get("/", authorize, getStaffExams); // Get staff's exams
router.get("/:examId", authorize, getExamById); // Get exam details
router.put("/:examId", authorize, updateExam); // Update exam
router.delete("/:examId", authorize, deleteExam); // Delete exam

// Question Bank
router.get("/bank/questions", authorize, getBankQuestions); // Get bank questions for exam creation
router.post("/bank/questions/objective", authorize, createObjectiveQuestion); // Create objective question
router.post("/bank/questions/theory", authorize, createTheoryQuestion); // Create theory question
router.get("/bank/questions/:questionId", authorize, getQuestionById); // Get question by ID
router.put(
  "/bank/questions/objective/:questionId",
  authorize,
  updateObjectiveQuestion
); // Update objective question
router.put(
  "/bank/questions/theory/:questionId",
  authorize,
  updateTheoryQuestion
); // Update theory question
router.delete("/bank/questions/:questionId", authorize, deleteQuestion); // Delete question

// Grading
router.get("/:examId/attempts", authorize, getExamAttempts); // Get all attempts for an exam
router.get("/attempts/:attemptId/grade", authorize, getAttemptForGrading); // Get attempt for grading
router.post("/answers/theory/:answerId/grade", authorize, gradeTheoryAnswer); // Grade single theory answer
router.post("/attempts/:attemptId/grade-bulk", authorize, bulkGradeTheory); // Bulk grade theory answers
router.get("/:examId/statistics", authorize, getExamStatistics); // Get exam statistics

// ==================== STUDENT ROUTES ====================
router.get("/student/exams", authorize, getStudentExams); // Get available exams
router.post("/student/exams/:examId/start", authorize, startExam); // Start exam attempt
router.post(
  "/student/exams/attempts/:attemptId/answer",
  authorize,
  submitAnswer
); // Submit answer
router.post("/student/exams/attempts/:attemptId/submit", authorize, submitExam); // Submit exam
router.get("/student/exams/attempts/:attemptId", authorize, getAttemptDetails); // Get attempt details

export default router;
