import { Router } from "express";
import { authorize } from "../middlewares/authorize.js";
import {
  createQuiz,
  addQuizQuestionsBatch,
  getStudentQuizzes,
  getQuiz,
  startQuizAttempt,
  saveQuizAnswers,
  submitQuizAttempt,
  updateQuizAttempt,
  getQuizStats,
  getMyLatestQuizAttempt,
  deleteQuiz,
} from "../controllers/quiz/quiz.js";

const router = Router();

router.post("/create-quiz", authorize, createQuiz);
router.post("/:quizId/questions-batch", authorize, addQuizQuestionsBatch);
router.get("/", authorize, getStudentQuizzes);
router.get("/:quizId", authorize, getQuiz);
router.post("/:quizId/attempts", authorize, startQuizAttempt);
router.post("/attempts/:attemptId/answers", authorize, saveQuizAnswers);
router.post("/attempts/:attemptId/submit", authorize, submitQuizAttempt);
router.get("/:quizId/my-latest", authorize, getMyLatestQuizAttempt);
router.get("/:quizId/stats", authorize, getQuizStats);
router.patch("/:quizId/update", authorize, updateQuizAttempt);
router.delete("/:quizId", authorize, deleteQuiz);

export default router;
