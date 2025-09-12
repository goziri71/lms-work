import { Router } from "express";
import { authorize } from "../middlewares/authorize.js";
import {
  createQuiz,
  addQuizQuestionsBatch,
  getQuiz,
} from "../controllers/quiz/quiz.js";

const router = Router();

router.post("/create-quiz", authorize, createQuiz);
router.post("/:quizId/questions-batch", authorize, addQuizQuestionsBatch);
router.get("/:quizId", authorize, getQuiz);

export default router;
