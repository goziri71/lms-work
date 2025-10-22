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
import {
  examLimiter,
  examStartLimiter,
  answerLimiter,
  questionCreationLimiter,
} from "../middlewares/rateLimiter.js";
import { cacheMiddleware } from "../middlewares/cacheMiddleware.js";

const router = express.Router();

// ==================== STAFF ROUTES ====================
// Exam Management
router.post("/", authorize, examLimiter, createExam); // Create exam
router.get("/", authorize, cacheMiddleware(300), getStaffExams); // Get staff's exams (cache 5 min)
router.get("/:examId", authorize, cacheMiddleware(600), getExamById); // Get exam details (cache 10 min)
router.put("/:examId", authorize, examLimiter, updateExam); // Update exam
router.delete("/:examId", authorize, examLimiter, deleteExam); // Delete exam

// Question Bank
router.get("/bank/questions", authorize, cacheMiddleware(600), getBankQuestions); // Get bank questions for exam creation (cache 10 min)
router.post("/bank/questions/objective", authorize, questionCreationLimiter, createObjectiveQuestion); // Create objective question
router.post("/bank/questions/theory", authorize, questionCreationLimiter, createTheoryQuestion); // Create theory question
router.get("/bank/questions/:questionId", authorize, getQuestionById); // Get question by ID
router.put(
  "/bank/questions/objective/:questionId",
  authorize,
  examLimiter,
  updateObjectiveQuestion
); // Update objective question
router.put(
  "/bank/questions/theory/:questionId",
  authorize,
  examLimiter,
  updateTheoryQuestion
); // Update theory question
router.delete("/bank/questions/:questionId", authorize, examLimiter, deleteQuestion); // Delete question

// Grading
router.get("/:examId/attempts", authorize, getExamAttempts); // Get all attempts for an exam
router.get("/attempts/:attemptId/grade", authorize, getAttemptForGrading); // Get attempt for grading
router.post("/answers/theory/:answerId/grade", authorize, examLimiter, gradeTheoryAnswer); // Grade single theory answer
router.post("/attempts/:attemptId/grade-bulk", authorize, examLimiter, bulkGradeTheory); // Bulk grade theory answers
router.get("/:examId/statistics", authorize, getExamStatistics); // Get exam statistics

// ==================== STUDENT ROUTES ====================
router.get("/student/exams", authorize, cacheMiddleware(180), getStudentExams); // Get available exams (cache 3 min)
router.post("/student/exams/:examId/start", authorize, examStartLimiter, startExam); // Start exam attempt
router.post(
  "/student/exams/attempts/:attemptId/answer",
  authorize,
  answerLimiter,
  submitAnswer
); // Submit answer
router.post("/student/exams/attempts/:attemptId/submit", authorize, examLimiter, submitExam); // Submit exam
router.get("/student/exams/attempts/:attemptId", authorize, cacheMiddleware(120), getAttemptDetails); // Get attempt details (cache 2 min)

export default router;
