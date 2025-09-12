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
import { Students } from "../../models/auth/student.js";

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

  console.log(module);

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

  console.log(course);

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

  console.log("addQuizQuestionsBatch called with:", {
    staffId,
    quizId,
    questions,
  });

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
  console.log("Found quiz:", quiz?.toJSON());

  if (!quiz) {
    throw new ErrorClass("Quiz not found", 404);
  }

  // Verify the staff owns this quiz
  if (quiz.created_by !== staffId) {
    throw new ErrorClass("You don't have permission to modify this quiz", 403);
  }

  console.log("Starting transaction for questions...");

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
      // Map request type to DB enum question_type
      // DB supports: "multiple_choice", "true_false", "short_answer", "essay"
      let question_type = "multiple_choice";
      if (type === "multiple_choice" || type === "single_choice") {
        question_type = "multiple_choice";
      } else if (type === "true_false") {
        question_type = "true_false";
      } else if (type === "short_answer") {
        question_type = "short_answer";
      } else if (type === "essay") {
        question_type = "essay";
      }

      const question = await QuizQuestions.create(
        {
          quiz_id: quizId,
          question_text: text,
          question_type,
          points,
          created_by: staffId,
        },
        { transaction: trx }
      );

      const optionPayload = options.map((o) => ({
        question_id: question.id,
        option_text: o.text,
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

export const getQuiz = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const quizId = Number(req.params.quizId);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (!Number.isInteger(quizId) || quizId <= 0) {
    throw new ErrorClass("Invalid quiz id", 400);
  }

  const quiz = await Quiz.findByPk(quizId, {
    include: [
      {
        model: QuizQuestions,
        as: "questions",
        include: [
          {
            model: QuizOptions,
            as: "options",
            attributes:
              userType === "staff"
                ? ["id", "text", "is_correct"]
                : ["id", "text"], // Hide correct answers from students
          },
        ],
      },
    ],
  });

  if (!quiz) {
    throw new ErrorClass("Quiz not found", 404);
  }

  // Verify access permissions
  const module = await Modules.findByPk(quiz.module_id);
  if (!module) {
    throw new ErrorClass("Module not found", 404);
  }

  if (userType === "staff") {
    // Staff must own the course containing this module
    const course = await Courses.findOne({
      where: { id: module.course_id, staff_id: userId },
    });
    if (!course) {
      throw new ErrorClass("You don't have permission to view this quiz", 403);
    }
  } else if (userType === "student") {
    // Student must be enrolled in the course
    const enrollment = await Courses.findOne({
      where: { id: module.course_id },
      include: [
        {
          model: Students,
          as: "students",
          where: { id: userId },
          required: true,
        },
      ],
    });
    if (!enrollment) {
      throw new ErrorClass("You are not enrolled in this course", 403);
    }
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Quiz retrieved successfully",
    data: quiz,
  });
});
