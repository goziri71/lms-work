import {
  Exam,
  ExamItem,
  ExamAttempt,
  QuestionBank,
  QuestionObjective,
  QuestionTheory,
} from "../models/exams/index.js";
import { Op } from "sequelize";

/**
 * Start an exam attempt - selects random questions from bank if needed
 */
export async function startExamAttempt(examId, studentId) {
  try {
    const exam = await Exam.findByPk(examId);
    if (!exam) throw new Error("Exam not found");
    if (exam.visibility !== "published") throw new Error("Exam not available");

    // Check if student already has an active attempt
    const existingAttempt = await ExamAttempt.findOne({
      where: {
        exam_id: examId,
        student_id: studentId,
        status: "in_progress",
      },
    });

    if (existingAttempt) {
      return { attempt: existingAttempt, isNew: false };
    }

    // Create new attempt
    const attempt = await ExamAttempt.create({
      exam_id: examId,
      student_id: studentId,
      started_at: new Date(),
      status: "in_progress",
    });

    // If random selection mode, pick questions now
    if (exam.selection_mode === "random") {
      await selectRandomQuestionsForAttempt(exam, attempt);
    }

    return { attempt, isNew: true };
  } catch (error) {
    console.error("Error starting exam attempt:", error);
    throw error;
  }
}

/**
 * Select random questions from the bank for this specific attempt
 */
async function selectRandomQuestionsForAttempt(exam, attempt) {
  try {
    const { objective_count = 0, theory_count = 0, course_id } = exam;
    const selectedQuestions = [];

    // Select random objective questions
    if (objective_count > 0) {
      const objectiveQuestions = await QuestionBank.findAll({
        where: {
          course_id,
          question_type: "objective",
          status: "approved",
        },
        order: [["id", "ASC"]],
      });

      const shuffled = shuffleArray(objectiveQuestions);
      const selected = shuffled.slice(0, objective_count);
      selectedQuestions.push(...selected);
    }

    // Select random theory questions
    if (theory_count > 0) {
      const theoryQuestions = await QuestionBank.findAll({
        where: {
          course_id,
          question_type: "theory",
          status: "approved",
        },
        order: [["id", "ASC"]],
      });

      const shuffled = shuffleArray(theoryQuestions);
      const selected = shuffled.slice(0, theory_count);
      selectedQuestions.push(...selected);
    }

    // Randomize final order if exam.randomize is true
    const finalOrder = exam.randomize
      ? shuffleArray(selectedQuestions)
      : selectedQuestions;

    // Create exam_items for this attempt
    for (let i = 0; i < finalOrder.length; i++) {
      await ExamItem.create({
        exam_id: exam.id,
        attempt_id: attempt.id,
        question_bank_id: finalOrder[i].id,
        order: i + 1,
      });
    }

    console.log(
      `Selected ${finalOrder.length} random questions for attempt ${attempt.id}`
    );
  } catch (error) {
    console.error("Error selecting random questions:", error);
    throw error;
  }
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Get questions for a specific attempt (per-student set)
 */
export async function getAttemptQuestions(attemptId) {
  try {
    const attempt = await ExamAttempt.findByPk(attemptId, {
      include: [{ model: Exam, as: "exam" }],
    });
    if (!attempt) throw new Error("Attempt not found");

    const exam = attempt.exam;

    // If random mode, get attempt-specific items
    if (exam.selection_mode === "random") {
      const items = await ExamItem.findAll({
        where: { attempt_id: attemptId },
        include: [
          {
            model: QuestionBank,
            as: "question",
            include: [
              {
                model: QuestionObjective,
                as: "objective",
                required: false,
              },
              {
                model: QuestionTheory,
                as: "theory",
                required: false,
              },
            ],
          },
        ],
        order: [["order", "ASC"]],
      });
      return items;
    } else {
      // Manual mode: get shared exam items
      const items = await ExamItem.findAll({
        where: { exam_id: exam.id, attempt_id: null },
        include: [
          {
            model: QuestionBank,
            as: "question",
            include: [
              {
                model: QuestionObjective,
                as: "objective",
                required: false,
              },
              {
                model: QuestionTheory,
                as: "theory",
                required: false,
              },
            ],
          },
        ],
        order: [["order", "ASC"]],
      });
      return items;
    }
  } catch (error) {
    console.error("Error getting attempt questions:", error);
    throw error;
  }
}
