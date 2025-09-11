import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { dbLibrary } from "../../database/database.js";
import { Quiz } from "../../models/modules/quiz.js";
import { QuizQuestions } from "../../models/modules/quiz_questions.js";
import { QuizOptions } from "../../models/modules/quiz_options.js";
import { QuizAttempts } from "../../models/modules/quiz_attempts.js";
import { QuizAnswers } from "../../models/modules/quiz_answers.js";
import { Courses } from "../../models/course/courses.js";
import { Modules } from "../../models/modules/modules.js";
import { Staff } from "../../models/auth/staff.js";

export const createQuiz = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id);
  console.log(staffId);
  const { module_id, duration_minutes, title, description, status } = req.body;

  if (!Number.isInteger(staffId) || staffId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }

  if (!module_id || !title) {
    throw new ErrorClass("module_id and title are required", 400);
  }

  // Verify the module exists
  const module = await Modules.findByPk(module_id);

  if (!module) {
    throw new ErrorClass("Module not found", 404);
  }

  // Verify the staff owns the course that contains this module
  const course = await Courses.findOne({
    where: {
      id: module.course_id,
      staff_id: staffId,
    },
  });

  if (!course) {
    throw new ErrorClass(
      "You don't have permission to create quiz for this module",
      403
    );
  }

  const quiz = await Quiz.create({
    module_id,
    title,
    description: description || null,
    duration_minutes: duration_minutes || null,
    status: status || "draft",
    created_by: staffId,
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "Quiz created",
    data: quiz,
  });
});

export const addQuizQuestionsBatch = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id);
  const quizId = Number(req.params.quizId);
  const { questions } = req.body;

  if (!Number.isInteger(staffId) || staffId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (!Number.isInteger(quizId) || quizId <= 0) {
    throw new ErrorClass("Invalid quiz id", 400);
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new ErrorClass("questions must be a non-empty array", 400);
  }

  const quiz = await Quiz.findByPk(quizId);
  if (!quiz) {
    throw new ErrorClass("Quiz not found", 404);
  }

  // Verify the staff owns this quiz
  if (quiz.created_by !== staffId) {
    throw new ErrorClass("You don't have permission to modify this quiz", 403);
  }

  const trx = await dbLibrary.transaction();
  try {
    const createdQuestions = [];

    for (const q of questions) {
      const { text, type = "single_choice", points = 1, options } = q;
      if (!text || !Array.isArray(options) || options.length < 2) {
        throw new ErrorClass(
          "Each question requires text and at least 2 options",
          400
        );
      }
      const numCorrect = options.filter((o) => !!o.is_correct).length;
      if (type === "single_choice" && numCorrect !== 1) {
        throw new ErrorClass(
          "single_choice questions must have exactly one correct option",
          400
        );
      }
      if (type === "multiple_choice" && numCorrect < 1) {
        throw new ErrorClass(
          "multiple_choice questions must have at least one correct option",
          400
        );
      }

      const question = await QuizQuestions.create(
        { quiz_id: quizId, text, type, points },
        { transaction: trx }
      );

      const optionPayload = options.map((o) => ({
        question_id: question.id,
        text: o.text,
        is_correct: !!o.is_correct,
      }));
      await QuizOptions.bulkCreate(optionPayload, { transaction: trx });

      const created = await QuizQuestions.findByPk(question.id, {
        include: [{ model: QuizOptions, as: "options" }],
        transaction: trx,
      });
      createdQuestions.push(created);
    }

    await trx.commit();
    res.status(201).json({
      status: true,
      code: 201,
      message: "Questions added",
      data: { quiz_id: quizId, questions: createdQuestions },
    });
  } catch (err) {
    await trx.rollback();
    throw err;
  }
});
