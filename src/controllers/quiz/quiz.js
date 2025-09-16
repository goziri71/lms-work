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
import { Op } from "sequelize";

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
      const { html, text, type = "single_choice", points = 1, options } = q;
      const questionText = html || text; // HTML preferred, fallback to plain text
      if (!questionText || !Array.isArray(options) || options.length < 2) {
        throw new ErrorClass(
          "Each question requires html (preferred) or text, and at least 2 options",
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
          question_text: questionText,
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

export const getStudentQuizzes = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const courseIdParam = Number(req.query?.course_id);
  const moduleIdParam = Number(req.query?.module_id);

  // Allow both students and staff to access quizzes
  if (userType !== "student" && userType !== "staff") {
    throw new ErrorClass("Only students and staff can view quiz list", 403);
  }

  // Build base quiz filter
  const quizWhere = userType === "staff" ? { created_by: userId } : {};

  // Resolve allowed course ids based on role
  let allowedCourseIds = [];
  if (userType === "staff") {
    const staffCourses = await Courses.findAll({
      where: { staff_id: userId },
      attributes: ["id"],
    });
    allowedCourseIds = staffCourses.map((c) => c.id);
  } else {
    const enrolledCourses = await Courses.findAll({
      where: {},
      attributes: ["id"],
      include: [
        {
          model: Students,
          as: "students",
          where: { id: userId },
          required: true,
          attributes: [],
        },
      ],
    });
    allowedCourseIds = enrolledCourses.map((c) => c.id);
  }

  // Compute module include filter
  const moduleWhere = {};
  if (allowedCourseIds.length > 0) {
    moduleWhere.course_id = { [Op.in]: allowedCourseIds };
  } else {
    // No allowed courses -> return empty list early
    return res.status(200).json({
      status: true,
      code: 200,
      message: "Quizzes retrieved successfully",
      data: [],
    });
  }
  if (Number.isInteger(courseIdParam) && courseIdParam > 0) {
    moduleWhere.course_id = courseIdParam;
    // Ensure filter is within allowed set for safety
    if (!allowedCourseIds.includes(courseIdParam)) {
      return res.status(200).json({
        status: true,
        code: 200,
        message: "Quizzes retrieved successfully",
        data: [],
      });
    }
  }
  if (Number.isInteger(moduleIdParam) && moduleIdParam > 0) {
    moduleWhere.id = moduleIdParam;
  }

  const quizzes = await Quiz.findAll({
    where: quizWhere,
    include: [
      {
        model: Modules,
        as: "module",
        attributes: ["id", "title", "course_id"],
        where: moduleWhere,
      },
      {
        model: QuizQuestions,
        as: "questions",
        include: [
          {
            model: QuizOptions,
            as: "options",
            attributes:
              userType === "staff"
                ? ["id", "option_text", "is_correct"] // Staff sees correct answers
                : ["id", "option_text"], // Students don't see correct answers
          },
        ],
      },
    ],
  });

  // Get attempts only for students
  let attemptsByQuiz = {};
  if (userType === "student") {
    const quizIds = quizzes.map((q) => q.id);
    const attempts = await QuizAttempts.findAll({
      where: { student_id: userId, quiz_id: { [Op.in]: quizIds } },
      order: [["submitted_at", "DESC"]],
    });

    // Group attempts by quiz
    attempts.forEach((attempt) => {
      if (
        !attemptsByQuiz[attempt.quiz_id] ||
        (attempt.submitted_at && !attemptsByQuiz[attempt.quiz_id].submitted_at)
      ) {
        attemptsByQuiz[attempt.quiz_id] = attempt;
      }
    });
  }

  // Format response based on user type
  const quizList = quizzes.map((quiz) => {
    const attempt = attemptsByQuiz[quiz.id];
    const baseResponse = {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      module_id: quiz.module_id,
      module_title: quiz.module?.title || "Unknown Module",
      duration_minutes: quiz.duration_minutes,
      attempts_allowed: quiz.attempts_allowed,
      status: quiz.status,
      questions:
        quiz.questions?.map((q) => ({
          id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          points: q.points,
          options: q.options?.map((opt) => ({
            id: opt.id,
            text: opt.option_text,
            ...(userType === "staff" && { is_correct: opt.is_correct }), // Staff sees correct answers
          })),
        })) || [],
    };

    // Add role-specific data
    if (userType === "student") {
      return {
        ...baseResponse,
        has_attempted: !!attempt,
        latest_attempt: attempt
          ? {
              id: attempt.id,
              status: attempt.status,
              score: attempt.total_score,
              max_score: attempt.max_possible_score,
              submitted_at: attempt.submitted_at,
            }
          : null,
      };
    } else {
      // Staff sees additional management info
      return {
        ...baseResponse,
        created_by: quiz.created_by,
        created_at: quiz.created_at,
        // TODO: Add quiz statistics (total attempts, average score, etc.)
      };
    }
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Quizzes retrieved successfully",
    data: quizList,
  });
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

export const startQuizAttempt = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const quizId = Number(req.params.quizId);

  if (userType !== "student") {
    throw new ErrorClass("Only students can start attempts", 403);
  }
  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (!Number.isInteger(quizId) || quizId <= 0) {
    throw new ErrorClass("Invalid quiz id", 400);
  }

  const quiz = await Quiz.findByPk(quizId);
  if (!quiz) throw new ErrorClass("Quiz not found", 404);

  const existing = await QuizAttempts.findOne({
    where: { quiz_id: quizId, student_id: studentId, status: "in_progress" },
  });
  if (existing) {
    return res.status(200).json({
      status: true,
      code: 200,
      message: "Attempt already in progress",
      data: existing,
    });
  }

  const attempt = await QuizAttempts.create({
    quiz_id: quizId,
    student_id: studentId,
    status: "in_progress",
    started_at: new Date(),
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "Attempt started",
    data: attempt,
  });
});

export const saveQuizAnswers = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const attemptId = Number(req.params.attemptId);
  const { answers } = req.body; // [{question_id, selected_option_ids?: number[], answer_text?: string}]

  if (userType !== "student") {
    throw new ErrorClass("Only students can save answers", 403);
  }
  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (!Number.isInteger(attemptId) || attemptId <= 0) {
    throw new ErrorClass("Invalid attempt id", 400);
  }
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new ErrorClass("answers must be a non-empty array", 400);
  }

  const attempt = await QuizAttempts.findByPk(attemptId);
  if (!attempt || attempt.student_id !== studentId) {
    throw new ErrorClass("Attempt not found or not yours", 404);
  }
  if (attempt.status !== "in_progress") {
    throw new ErrorClass("Attempt is not in progress", 400);
  }

  const trx = await dbLibrary.transaction();
  try {
    for (const a of answers) {
      const { question_id, selected_option_ids, answer_text } = a;
      if (!Number.isInteger(question_id)) {
        throw new ErrorClass("Invalid question_id", 400);
      }

      // Upsert pattern per question
      if (
        Array.isArray(selected_option_ids) &&
        selected_option_ids.length > 0
      ) {
        // Delete previous selections for this question
        await QuizAnswers.destroy({
          where: { attempt_id: attemptId, question_id },
          transaction: trx,
        });
        // Insert one row per selected option
        const rows = selected_option_ids.map((optId) => ({
          attempt_id: attemptId,
          question_id,
          selected_option_id: Number(optId),
        }));
        await QuizAnswers.bulkCreate(rows, { transaction: trx });
      } else {
        // Free-text answer
        const existing = await QuizAnswers.findOne({
          where: { attempt_id: attemptId, question_id },
          transaction: trx,
        });
        if (existing) {
          await existing.update({ answer_text }, { transaction: trx });
        } else {
          await QuizAnswers.create(
            { attempt_id: attemptId, question_id, answer_text },
            { transaction: trx }
          );
        }
      }
    }

    await trx.commit();
    res.status(200).json({
      status: true,
      code: 200,
      message: "Answers saved",
    });
  } catch (err) {
    await trx.rollback();
    throw err;
  }
});

export const submitQuizAttempt = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const attemptId = Number(req.params.attemptId);

  if (userType !== "student") {
    throw new ErrorClass("Only students can submit attempts", 403);
  }
  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (!Number.isInteger(attemptId) || attemptId <= 0) {
    throw new ErrorClass("Invalid attempt id", 400);
  }

  const attempt = await QuizAttempts.findByPk(attemptId);
  if (!attempt || attempt.student_id !== studentId) {
    throw new ErrorClass("Attempt not found or not yours", 404);
  }
  if (attempt.status !== "in_progress") {
    throw new ErrorClass("Attempt is not in progress", 400);
  }

  // Fetch all questions and options for grading
  const questions = await QuizQuestions.findAll({
    where: { quiz_id: attempt.quiz_id },
    include: [{ model: QuizOptions, as: "options" }],
  });

  const answers = await QuizAnswers.findAll({
    where: { attempt_id: attemptId },
  });

  let total = 0;
  let max = 0;

  const questionIdToAnswers = new Map();
  for (const ans of answers) {
    const arr = questionIdToAnswers.get(ans.question_id) || [];
    arr.push(ans);
    questionIdToAnswers.set(ans.question_id, arr);
  }

  for (const q of questions) {
    max += Number(q.points || 0);
    const selected = (questionIdToAnswers.get(q.id) || []).map(
      (a) => a.selected_option_id
    );
    const correctOptionIds = q.options
      .filter((o) => o.is_correct)
      .map((o) => o.id);

    // Simple grading: full points only if sets match exactly
    const selectedSet = new Set(selected);
    const correctSet = new Set(correctOptionIds);
    const isCorrect =
      selected.length === correctOptionIds.length &&
      [...selectedSet].every((id) => correctSet.has(id));

    if (isCorrect) total += Number(q.points || 0);
  }

  await attempt.update({
    status: "submitted",
    total_score: total,
    max_possible_score: max,
    submitted_at: new Date(),
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Attempt submitted",
    data: {
      attempt_id: attempt.id,
      total_score: total,
      max_possible_score: max,
    },
  });
});

export const updateQuizAttempt = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const quizId = Number(req.params.quizId);

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can update quizzes", 403);
  }
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (!Number.isInteger(quizId) || quizId <= 0) {
    throw new ErrorClass("Invalid quiz id", 400);
  }

  const { quiz: quizPayload, questions } = req.body || {};

  const quiz = await Quiz.findByPk(quizId);
  if (!quiz) {
    throw new ErrorClass("Quiz not found", 404);
  }

  // Verify the staff owns the course that contains this quiz's module
  const module = await Modules.findByPk(quiz.module_id);
  if (!module) {
    throw new ErrorClass("Module not found", 404);
  }
  const course = await Courses.findOne({
    where: { id: module.course_id, staff_id: userId },
  });
  if (!course) {
    throw new ErrorClass("You don't have permission to modify this quiz", 403);
  }

  const trx = await dbLibrary.transaction();
  try {
    // 1) Update quiz metadata if provided
    if (quizPayload && typeof quizPayload === "object") {
      const updatable = {};
      if (typeof quizPayload.title === "string")
        updatable.title = quizPayload.title;
      if (typeof quizPayload.description !== "undefined")
        updatable.description = quizPayload.description;
      if (typeof quizPayload.duration_minutes !== "undefined")
        updatable.duration_minutes = quizPayload.duration_minutes;
      if (typeof quizPayload.status === "string")
        updatable.status = quizPayload.status;
      if (Object.keys(updatable).length > 0) {
        await quiz.update(updatable, { transaction: trx });
      }
    }

    // 2) Upsert questions and options if provided
    if (Array.isArray(questions) && questions.length > 0) {
      for (const q of questions) {
        const {
          id: questionId,
          delete: deleteQuestion,
          html,
          text,
          question_type,
          type, // allow alias from creation flow
          points,
          options,
        } = q || {};

        if (deleteQuestion === true && questionId) {
          // Delete question and cascade delete options
          const existingQ = await QuizQuestions.findOne({
            where: { id: questionId, quiz_id: quizId },
            transaction: trx,
          });
          if (existingQ) {
            await QuizOptions.destroy({
              where: { question_id: existingQ.id },
              transaction: trx,
            });
            await existingQ.destroy({ transaction: trx });
          }
          continue;
        }

        // Determine target question_type aligned with DB enum
        let targetType = question_type;
        if (!targetType) {
          if (type === "true_false") targetType = "true_false";
          else if (type === "short_answer") targetType = "short_answer";
          else if (type === "essay") targetType = "essay";
          else if (type === "multiple_choice" || type === "single_choice")
            targetType = "multiple_choice";
        }
        if (!targetType) targetType = "multiple_choice";

        // Build question text (prefer html)
        const questionText = html || text;

        let questionRecord;
        if (questionId) {
          // Update existing question
          questionRecord = await QuizQuestions.findOne({
            where: { id: questionId, quiz_id: quizId },
            transaction: trx,
          });
          if (!questionRecord) {
            throw new ErrorClass(
              `Question ${questionId} not found in this quiz`,
              404
            );
          }
          const updateFields = {};
          if (typeof questionText !== "undefined")
            updateFields.question_text = questionText;
          if (typeof targetType === "string")
            updateFields.question_type = targetType;
          if (typeof points !== "undefined") updateFields.points = points;
          if (Object.keys(updateFields).length > 0) {
            await questionRecord.update(updateFields, { transaction: trx });
          }
        } else {
          // Create new question
          if (!questionText) {
            throw new ErrorClass("New questions require html or text", 400);
          }
          questionRecord = await QuizQuestions.create(
            {
              quiz_id: quizId,
              question_text: questionText,
              question_type: targetType,
              points: typeof points !== "undefined" ? points : 1,
              created_by: userId,
            },
            { transaction: trx }
          );
        }

        // Handle options for choice questions
        if (targetType === "multiple_choice" || targetType === "true_false") {
          if (Array.isArray(options)) {
            // Validate correctness rules
            const providedCorrect = options.filter((o) => !!o?.is_correct);
            if (targetType === "true_false") {
              // Must have exactly one correct
              if (providedCorrect.length !== 1) {
                throw new ErrorClass(
                  "true_false must have exactly one correct option",
                  400
                );
              }
            } else {
              // multiple_choice allows one or more correct
              if (providedCorrect.length < 1) {
                throw new ErrorClass(
                  "multiple_choice must have at least one correct option",
                  400
                );
              }
            }

            for (const opt of options) {
              const {
                id: optionId,
                delete: deleteOption,
                option_text,
                text: textAlias,
                is_correct,
              } = opt || {};
              if (deleteOption === true && optionId) {
                await QuizOptions.destroy({
                  where: { id: optionId, question_id: questionRecord.id },
                  transaction: trx,
                });
                continue;
              }

              const optionPayload = {
                option_text:
                  typeof option_text !== "undefined" ? option_text : textAlias,
                is_correct: !!is_correct,
              };

              if (optionId) {
                const existingOpt = await QuizOptions.findOne({
                  where: { id: optionId, question_id: questionRecord.id },
                  transaction: trx,
                });
                if (!existingOpt) {
                  throw new ErrorClass(
                    `Option ${optionId} not found for question ${questionRecord.id}`,
                    404
                  );
                }
                const updateOpt = {};
                if (typeof optionPayload.option_text !== "undefined")
                  updateOpt.option_text = optionPayload.option_text;
                if (typeof is_correct !== "undefined")
                  updateOpt.is_correct = !!is_correct;
                if (Object.keys(updateOpt).length > 0) {
                  await existingOpt.update(updateOpt, { transaction: trx });
                }
              } else {
                // Create new option
                if (!optionPayload.option_text) {
                  throw new ErrorClass("New options require option_text", 400);
                }
                await QuizOptions.create(
                  {
                    question_id: questionRecord.id,
                    option_text: optionPayload.option_text,
                    is_correct: optionPayload.is_correct,
                  },
                  { transaction: trx }
                );
              }
            }
          }
        } else {
          // Non-choice questions: ignore options if sent
          // Optionally, could delete any existing options to keep data clean
          // await QuizOptions.destroy({ where: { question_id: questionRecord.id }, transaction: trx });
        }
      }
    }

    await trx.commit();

    // Return updated quiz with questions/options (staff view includes is_correct)
    const updated = await Quiz.findByPk(quizId, {
      include: [
        {
          model: QuizQuestions,
          as: "questions",
          include: [
            {
              model: QuizOptions,
              as: "options",
            },
          ],
        },
      ],
    });

    res.status(200).json({
      status: true,
      code: 200,
      message: "Quiz updated successfully",
      data: updated,
    });
  } catch (err) {
    await trx.rollback();
    throw err;
  }
});

export const deleteQuiz = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const quizId = Number(req.params.quizId);

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can delete quizzes", 403);
  }
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (!Number.isInteger(quizId) || quizId <= 0) {
    throw new ErrorClass("Invalid quiz id", 400);
  }

  const quiz = await Quiz.findByPk(quizId);
  if (!quiz) {
    throw new ErrorClass("Quiz not found", 404);
  }

  // Verify staff owns the course that contains the module for this quiz
  const module = await Modules.findByPk(quiz.module_id);
  if (!module) {
    throw new ErrorClass("Module not found", 404);
  }
  const course = await Courses.findOne({
    where: { id: module.course_id, staff_id: userId },
  });
  if (!course) {
    throw new ErrorClass("You don't have permission to delete this quiz", 403);
  }

  const trx = await dbLibrary.transaction();
  try {
    await Quiz.destroy({ where: { id: quizId }, transaction: trx });
    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Quiz deleted successfully",
  });
});
