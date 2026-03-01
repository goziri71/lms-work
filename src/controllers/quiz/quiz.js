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
import {
  syncQuizQuestionToBank,
  deleteQuizQuestionFromBank,
} from "../../services/examBankSync.js";
import {
  canAccessCourse,
  canModifyQuiz,
  getCreatorId,
} from "../../utils/examAccessControl.js";
import { logAdminActivity } from "../../middlewares/adminAuthorize.js";

function canManageQuizzes(userType) {
  return [
    "staff",
    "admin",
    "super_admin",
    "sole_tutor",
    "organization",
    "organization_user",
  ].includes(userType);
}

export const createQuiz = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const { module_id, duration_minutes, title, description, status } = req.body;

  if (!canManageQuizzes(userType)) {
    throw new ErrorClass(
      "Only authorized tutors, staff, and admins can create quizzes",
      403
    );
  }

  if (!Number.isInteger(userId) || userId <= 0) {
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

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(
    userType,
    userId,
    module.course_id,
    req.user
  );
  if (!hasAccess) {
    throw new ErrorClass(
      "You don't have permission to create quiz for this module",
      403
    );
  }

  // Get creator ID (admin ID for admins, staff ID for staff)
  const creatorId = getCreatorId(userType, userId);

  const quiz = await Quiz.create({
    module_id,
    title,
    description: description || null,
    duration_minutes: duration_minutes || null,
    status: status || "draft",
    created_by: creatorId,
  });

  // Log admin activity if created by admin
  if (userType === "admin") {
    try {
      await logAdminActivity(userId, "created_quiz", "quiz", quiz.id, {
        module_id: module_id,
        course_id: module.course_id,
        title: title,
      });
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: "Quiz created",
    data: quiz,
  });
});

export const addQuizQuestionsBatch = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const quizId = Number(req.params.quizId);
  const { questions } = req.body;

  console.log("addQuizQuestionsBatch called with:", {
    userId,
    userType,
    quizId,
    questions,
  });

  if (!Number.isInteger(userId) || userId <= 0) {
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

  // Verify user can modify this quiz (admin can modify all, staff only their own)
  const accessCheck = await canModifyQuiz(userType, userId, quizId, req.user);
  if (!accessCheck.allowed) {
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
      // DB supports: "single_choice", "multiple_choice", "true_false", "short_answer", "essay"
      let question_type = "multiple_choice";
      if (type === "single_choice") {
        question_type = "single_choice";
      } else if (type === "multiple_choice") {
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
          created_by: getCreatorId(userType, userId),
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

    // Sync all created questions to exam bank (async, non-blocking)
    console.log("Questions created, syncing to exam bank...");
    for (const q of createdQuestions) {
      syncQuizQuestionToBank(q, q.options || []).catch((err) =>
        console.error("Failed to sync question to bank:", err)
      );
    }

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

  // console.log("[getStudentQuizzes] user:", { userId, userType });
  // console.log("[getStudentQuizzes] courseIdParam:", courseIdParam);
  // console.log("[getStudentQuizzes] moduleIdParam:", moduleIdParam);

  // Allow enrolled learners plus quiz managers
  if (!canManageQuizzes(userType) && userType !== "student") {
    throw new ErrorClass(
      "Only enrolled learners, authorized tutors, staff, and admins can view quiz list",
      403
    );
  }

  // Build base quiz filter
  // Admins can see all quizzes, staff only their own, students see all (filtered by enrollment)
  const quizWhere = userType === "staff" ? { created_by: userId } : {};

  // Resolve allowed course ids based on role
  let allowedCourseIds = [];
  if (userType === "admin" || userType === "super_admin") {
    // Admins can access all courses - get all course IDs
    const allCourses = await Courses.findAll({
      attributes: ["id"],
    });
    allowedCourseIds = allCourses.map((c) => c.id);
  } else if (userType === "staff") {
    const staffCourses = await Courses.findAll({
      where: { staff_id: userId },
      attributes: ["id"],
    });
    allowedCourseIds = staffCourses.map((c) => c.id);
  } else if (userType === "sole_tutor") {
    const tutorCourses = await Courses.findAll({
      where: {
        owner_type: "sole_tutor",
        owner_id: userId,
      },
      attributes: ["id"],
    });
    allowedCourseIds = tutorCourses.map((c) => c.id);
  } else if (userType === "organization") {
    const orgCourses = await Courses.findAll({
      where: {
        owner_type: "organization",
        owner_id: userId,
      },
      attributes: ["id"],
    });
    allowedCourseIds = orgCourses.map((c) => c.id);
  } else if (userType === "organization_user") {
    const organizationId = Number(
      req.user?.organizationId || req.user?.organization_id || 0
    );
    if (Number.isInteger(organizationId) && organizationId > 0) {
      const orgCourses = await Courses.findAll({
        where: {
          owner_type: "organization",
          owner_id: organizationId,
        },
        attributes: ["id"],
      });
      allowedCourseIds = orgCourses.map((c) => c.id);
    } else {
      allowedCourseIds = [];
    }
  } else {
    // For students, get enrolled courses via the junction table
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

  // Step 1: Get modules that belong to allowed courses
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

  console.log("[getStudentQuizzes] user:", { userId, userType });
  console.log("[getStudentQuizzes] allowedCourseIds:", allowedCourseIds);
  console.log("[getStudentQuizzes] moduleWhere:", moduleWhere);

  // Step 2: Get modules from dbLibrary that match our criteria
  const modules = await Modules.findAll({
    where: moduleWhere,
    attributes: ["id", "title", "course_id"],
  });

  if (modules.length === 0) {
    return res.status(200).json({
      status: true,
      code: 200,
      message: "Quizzes retrieved successfully",
      data: [],
    });
  }

  const moduleIds = modules.map((m) => m.id);
  const moduleMap = new Map(modules.map((m) => [m.id, m]));

  // Step 3: Get quizzes for these modules
  const finalQuizWhere = {
    ...quizWhere,
    module_id: { [Op.in]: moduleIds },
  };

  let quizzes;
  try {
    console.log("[getStudentQuizzes] finalQuizWhere:", finalQuizWhere);
    quizzes = await Quiz.findAll({
      where: finalQuizWhere,
      include: [
        {
          model: QuizQuestions,
          as: "questions",
          include: [
            {
              model: QuizOptions,
              as: "options",
              attributes: canManageQuizzes(userType)
                ? ["id", "option_text", "is_correct"]
                : ["id", "option_text"],
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error("[getStudentQuizzes] Query failed:", err?.message, err);
    throw err;
  }

  // Get attempts only for students
  let attemptsByQuiz = {};
  if (userType === "student") {
    const quizIds = quizzes.map((q) => q.id);
    if (quizIds.length > 0) {
      const attempts = await QuizAttempts.findAll({
        where: { student_id: userId, quiz_id: { [Op.in]: quizIds } },
        order: [["submitted_at", "DESC"]],
      });

      // Group attempts by quiz
      attempts.forEach((attempt) => {
        if (
          !attemptsByQuiz[attempt.quiz_id] ||
          (attempt.submitted_at &&
            !attemptsByQuiz[attempt.quiz_id].submitted_at)
        ) {
          attemptsByQuiz[attempt.quiz_id] = attempt;
        }
      });
    }
  }

  // Format response based on user type
  const quizList = quizzes.map((quiz) => {
    const attempt = attemptsByQuiz[quiz.id];
    const module = moduleMap.get(quiz.module_id);
    const baseResponse = {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      module_id: quiz.module_id,
      module_title: module?.title || "Unknown Module",
      course_id: module?.course_id || null,
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
            ...(canManageQuizzes(userType) && { is_correct: opt.is_correct }), // Managers see correct answers
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
      // Quiz managers see additional management info
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
            attributes: canManageQuizzes(userType)
              ? ["id", "option_text", "is_correct"]
              : ["id", "option_text"], // Hide correct answers from learners
          },
        ],
      },
    ],
  });

  console.log("quiz", quiz);

  if (!quiz) {
    throw new ErrorClass("Quiz not found", 404);
  }

  // Verify access permissions
  const module = await Modules.findByPk(quiz.module_id);
  if (!module) {
    throw new ErrorClass("Module not found", 404);
  }

  // Admins can access all quizzes
  if (userType === "admin" || userType === "super_admin") {
    // No additional check needed - admins have full access
  } else if (userType === "staff") {
    // Staff must own the course containing this module
    const course = await Courses.findOne({
      where: { id: module.course_id, staff_id: userId },
    });
    if (!course) {
      throw new ErrorClass("You don't have permission to view this quiz", 403);
    }
  } else if (
    userType === "sole_tutor" ||
    userType === "organization" ||
    userType === "organization_user"
  ) {
    const hasAccess = await canAccessCourse(
      userType,
      userId,
      module.course_id,
      req.user
    );
    if (!hasAccess) {
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
  } else {
    throw new ErrorClass("Unauthorized access", 403);
  }

  // Compute remaining time for students with an in-progress attempt
  let remainingSeconds = null;
  if (userType === "student") {
    const inProgressAttempt = await QuizAttempts.findOne({
      where: { quiz_id: quizId, student_id: userId, status: "in_progress" },
    });
    if (inProgressAttempt) {
      const durationMinutes = quiz.duration_minutes;
      if (typeof durationMinutes === "number" && durationMinutes > 0) {
        const nowMs = Date.now();
        const startedMs = new Date(inProgressAttempt.started_at).getTime();
        const elapsed = Math.floor((nowMs - startedMs) / 1000);
        remainingSeconds = Math.max(durationMinutes * 60 - elapsed, 0);
      }
    }
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Quiz retrieved successfully",
    data: quiz,
    remaining_seconds: remainingSeconds,
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

  // Optional: only allow published quizzes
  if (quiz.status && quiz.status !== "published") {
    throw new ErrorClass("Quiz is not available", 403);
  }

  // Validate student enrollment for quiz's course
  const module = await Modules.findByPk(quiz.module_id);
  if (!module) throw new ErrorClass("Module not found", 404);
  const enrollment = await Courses.findOne({
    where: { id: module.course_id },
    include: [
      {
        model: Students,
        as: "students",
        where: { id: studentId },
        required: true,
      },
    ],
  });
  if (!enrollment) {
    throw new ErrorClass("You are not enrolled in this course", 403);
  }

  const existing = await QuizAttempts.findOne({
    where: { quiz_id: quizId, student_id: studentId, status: "in_progress" },
  });

  console.log("existing", existing);

  if (existing) {
    // If there's an in-progress attempt, compute remaining time
    let remainingSeconds = null;
    if (
      typeof quiz.duration_minutes === "number" &&
      quiz.duration_minutes > 0 &&
      existing.started_at
    ) {
      const nowMs = Date.now();
      const startedMs = new Date(existing.started_at).getTime();
      const elapsed = Math.floor((nowMs - startedMs) / 1000);
      remainingSeconds = Math.max(quiz.duration_minutes * 60 - elapsed, 0);
    }

    if (remainingSeconds !== null && remainingSeconds <= 0) {
      // Time expired: require submit to finalize before starting a new attempt
      throw new ErrorClass(
        "Time limit exceeded for existing attempt. Please submit.",
        400
      );
    }

    return res.status(200).json({
      status: true,
      code: 200,
      message: "Attempt already in progress",
      data: existing,
      remaining_seconds: remainingSeconds,
    });
  }

  // Enforce attempts_allowed limit against submitted attempts
  if (typeof quiz.attempts_allowed === "number" && quiz.attempts_allowed > 0) {
    const submittedCount = await QuizAttempts.count({
      where: { quiz_id: quizId, student_id: studentId, status: "submitted" },
    });
    if (submittedCount >= quiz.attempts_allowed) {
      throw new ErrorClass("Maximum attempts reached", 403);
    }
  }

  const attempt = await QuizAttempts.create({
    quiz_id: quizId,
    student_id: studentId,
    status: "in_progress",
    started_at: new Date(),
  });

  // Compute remaining time at start
  let remainingSeconds = null;
  if (typeof quiz.duration_minutes === "number" && quiz.duration_minutes > 0) {
    remainingSeconds = quiz.duration_minutes * 60;
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: "Attempt started",
    data: attempt,
    remaining_seconds: remainingSeconds,
  });
});

// export const getQuizAtempt = TryCatchFunction(async (req, res) => {
//   const studentId = Number(req.user?.id);
//   const userType = req.user?.userType;

// });

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

  // Enforce time limit (server-side)
  let remainingSeconds = null;
  const quiz = await Quiz.findByPk(attempt.quiz_id);
  if (
    quiz &&
    typeof quiz.duration_minutes === "number" &&
    quiz.duration_minutes > 0
  ) {
    const nowMs = Date.now();
    const startedMs = new Date(attempt.started_at).getTime();
    const elapsed = Math.floor((nowMs - startedMs) / 1000);
    remainingSeconds = Math.max(quiz.duration_minutes * 60 - elapsed, 0);
    if (remainingSeconds <= 0) {
      throw new ErrorClass("Time limit exceeded", 400);
    }
  }

  const trx = await dbLibrary.transaction();
  try {
    console.log("[saveQuizAnswers] payload:", JSON.stringify(answers));
    for (const a of answers) {
      const {
        question_id,
        selected_option_ids,
        selected_option_id,
        answer_text,
      } = a || {};
      if (!Number.isInteger(question_id)) {
        throw new ErrorClass("Invalid question_id", 400);
      }

      // Upsert pattern per question
      const optionIds = Array.isArray(selected_option_ids)
        ? selected_option_ids
        : typeof selected_option_id !== "undefined" &&
          selected_option_id !== null
        ? [selected_option_id]
        : [];

      if (optionIds.length > 0) {
        // Delete previous selections for this question
        await QuizAnswers.destroy({
          where: { attempt_id: attemptId, question_id },
          transaction: trx,
        });
        // Insert one row per selected option
        const rows = optionIds.map((optId) => ({
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
      remaining_seconds: remainingSeconds,
    });
  } catch (err) {
    console.error("[saveQuizAnswers] error:", err?.message, err);
    await trx.rollback();
    throw err;
  }
});

export const submitQuizAttempt = TryCatchFunction(async (req, res) => {
  console.log("=== SUBMIT QUIZ ATTEMPT CALLED ===");
  console.log("Request params:", req.params);
  console.log("Request body:", req.body);
  console.log("User:", req.user);

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
  // Compute remaining time and note expiry
  const quiz = await Quiz.findByPk(attempt.quiz_id);
  console.log("quiz", quiz);
  let remainingSeconds = null;
  let expired = false;
  if (
    quiz &&
    typeof quiz.duration_minutes === "number" &&
    quiz.duration_minutes > 0
  ) {
    const nowMs = Date.now();
    const startedMs = new Date(attempt.started_at).getTime();
    const elapsed = Math.floor((nowMs - startedMs) / 1000);
    remainingSeconds = Math.max(quiz.duration_minutes * 60 - elapsed, 0);
    expired = remainingSeconds <= 0;
  }

  const questions = await QuizQuestions.findAll({
    where: { quiz_id: attempt.quiz_id },
    include: [{ model: QuizOptions, as: "options" }],
  });

  console.log("questions", questions);

  const answers = await QuizAnswers.findAll({
    where: { attempt_id: attemptId },
  });

  console.log("answers", answers);
  console.log("Answers length:", answers ? answers.length : "null");
  console.log("About to start grading process...");

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

  console.log("Grading complete - Total:", total, "Max:", max);
  console.log("Attempt object:", attempt ? "exists" : "null");
  console.log("Attempt ID:", attempt?.id);

  await attempt.update({
    status: "submitted",
    total_score: total,
    max_possible_score: max,
    submitted_at: new Date(),
  });

  console.log("Attempt updated successfully");

  console.log("attempt", attempt);

  res.status(200).json({
    status: true,
    code: 200,
    message: "Attempt submitted",
    data: {
      attempt_id: attempt.id,
      total_score: total,
      max_possible_score: max,
    },
    remaining_seconds: remainingSeconds,
    expired,
  });
});

export const getQuizStats = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const quizId = Number(req.params.quizId);
  const filterStudentId = Number(req.query?.student_id);
  const page = Math.max(1, Number(req.query?.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 50));
  const sort = (req.query?.sort || "date").toString(); // 'score' | 'date'
  const search = (req.query?.search || "").toString().trim().toLowerCase();

  if (!canManageQuizzes(userType)) {
    throw new ErrorClass(
      "Only authorized tutors, staff, and admins can view quiz stats",
      403
    );
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

  // Verify user can access the course (admin can access all, staff only their own)
  const module = await Modules.findByPk(quiz.module_id);
  if (!module) {
    throw new ErrorClass("Module not found", 404);
  }
  const hasAccess = await canAccessCourse(
    userType,
    userId,
    module.course_id,
    req.user
  );
  if (!hasAccess) {
    throw new ErrorClass("Access denied", 403);
  }

  // Focused per-student view
  if (Number.isInteger(filterStudentId) && filterStudentId > 0) {
    const attempts = await QuizAttempts.findAll({
      where: { quiz_id: quizId, student_id: filterStudentId },
      attributes: [
        "id",
        "status",
        "total_score",
        "max_possible_score",
        "started_at",
        "submitted_at",
      ],
      order: [["submitted_at", "DESC"]],
    });

    const attempts_count = attempts.length;
    const latest_attempt = attempts_count > 0 ? attempts[0] : null;
    const best_attempt =
      attempts_count > 0
        ? attempts.reduce((best, a) =>
            Number(a.total_score || 0) > Number(best.total_score || 0)
              ? a
              : best
          )
        : null;
    const average_score =
      attempts_count > 0
        ? attempts.reduce((acc, a) => acc + Number(a.total_score || 0), 0) /
          attempts_count
        : 0;
    const max_possible_score = attempts.reduce(
      (acc, a) => Math.max(acc, Number(a.max_possible_score || 0)),
      0
    );

    return res.status(200).json({
      status: true,
      code: 200,
      message: "Quiz stats retrieved successfully",
      data: {
        quiz_id: quizId,
        student_id: filterStudentId,
        attempts_count,
        average_score,
        max_possible_score,
        latest_attempt,
        best_attempt,
        attempts,
      },
    });
  }

  // Overall stats over submitted attempts
  const submittedAttempts = await QuizAttempts.findAll({
    where: { quiz_id: quizId, status: "submitted" },
    attributes: [
      "id",
      "student_id",
      "total_score",
      "max_possible_score",
      "started_at",
      "submitted_at",
    ],
    order: [["submitted_at", "DESC"]],
  });

  const submitted_attempts = submittedAttempts.length;
  const average_score =
    submitted_attempts > 0
      ? submittedAttempts.reduce(
          (acc, a) => acc + Number(a.total_score || 0),
          0
        ) / submitted_attempts
      : 0;
  const max_possible_score = submittedAttempts.reduce(
    (acc, a) => Math.max(acc, Number(a.max_possible_score || 0)),
    0
  );

  // Participation
  const moduleRecord = await Modules.findByPk(quiz.module_id);
  let enrolledStudents = [];
  if (moduleRecord) {
    const course = await Courses.findByPk(moduleRecord.course_id, {
      include: [
        {
          model: Students,
          as: "students",
          attributes: ["id", "fname", "lname", "email"],
        },
      ],
    });
    enrolledStudents = course?.students || [];
  }
  const total_enrolled = enrolledStudents.length;
  const attemptedStudentIds = Array.from(
    new Set(submittedAttempts.map((a) => a.student_id))
  );
  const total_attempted = attemptedStudentIds.length;
  const completion_rate =
    total_enrolled > 0
      ? Math.round((total_attempted / total_enrolled) * 100)
      : 0;

  // Latest attempt per student -> rows
  const latestByStudent = new Map();
  for (const a of submittedAttempts) {
    const prev = latestByStudent.get(a.student_id);
    if (
      !prev ||
      new Date(a.submitted_at).getTime() > new Date(prev.submitted_at).getTime()
    ) {
      latestByStudent.set(a.student_id, a);
    }
  }
  const studentInfoById = new Map(enrolledStudents.map((s) => [s.id, s]));
  let studentsRows = Array.from(latestByStudent.entries()).map(
    ([student_id, att]) => {
      const stu = studentInfoById.get(student_id) || {};
      const total_score = Number(att.total_score || 0);
      const max_score = Number(att.max_possible_score || 0);
      const percentage =
        max_score > 0 ? Math.round((total_score / max_score) * 100) : 0;
      return {
        student_id,
        full_name: [stu.fname, stu.lname].filter(Boolean).join(" ") || null,
        email: stu.email || null,
        attempt_id: att.id,
        total_score,
        max_score,
        percentage,
        started_at: att.started_at,
        submitted_at: att.submitted_at,
      };
    }
  );

  if (search) {
    studentsRows = studentsRows.filter(
      (r) =>
        (r.full_name || "").toLowerCase().includes(search) ||
        (r.email || "").toLowerCase().includes(search)
    );
  }
  if (sort === "score") {
    studentsRows.sort((a, b) => b.total_score - a.total_score);
  } else {
    studentsRows.sort(
      (a, b) =>
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    );
  }
  const totalRows = studentsRows.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const students = studentsRows.slice(start, end);

  // Distribution
  const distribution = {
    "0-39": 0,
    "40-49": 0,
    "50-59": 0,
    "60-69": 0,
    "70-100": 0,
  };
  for (const a of submittedAttempts) {
    const s = Number(a.total_score || 0);
    const m = Number(a.max_possible_score || 0);
    const pct = m > 0 ? (s / m) * 100 : 0;
    if (pct < 40) distribution["0-39"]++;
    else if (pct < 50) distribution["40-49"]++;
    else if (pct < 60) distribution["50-59"]++;
    else if (pct < 70) distribution["60-69"]++;
    else distribution["70-100"]++;
  }

  // Question insights (correct rate)
  const questions = await QuizQuestions.findAll({ where: { quiz_id: quizId } });
  const questionIds = questions.map((q) => q.id);
  let questions_insights = [];
  if (questionIds.length > 0 && submittedAttempts.length > 0) {
    const options = await QuizOptions.findAll({
      where: { question_id: { [Op.in]: questionIds } },
    });
    const optsByQ = new Map();
    for (const o of options) {
      const list = optsByQ.get(o.question_id) || [];
      list.push(o);
      optsByQ.set(o.question_id, list);
    }
    const attemptIds = submittedAttempts.map((a) => a.id);
    const answers = await QuizAnswers.findAll({
      where: { attempt_id: { [Op.in]: attemptIds } },
    });
    const answersByAttemptQ = new Map();
    for (const ans of answers) {
      const key = `${ans.attempt_id}-${ans.question_id}`;
      const list = answersByAttemptQ.get(key) || [];
      if (typeof ans.selected_option_id === "number")
        list.push(ans.selected_option_id);
      answersByAttemptQ.set(key, list);
    }
    for (const q of questions) {
      const correctIds = (optsByQ.get(q.id) || [])
        .filter((o) => o.is_correct)
        .map((o) => o.id);
      const correctSet = new Set(correctIds);
      let totalSeen = 0;
      let correctCount = 0;
      for (const a of submittedAttempts) {
        const key = `${a.id}-${q.id}`;
        const sel = answersByAttemptQ.get(key) || [];
        if (sel.length === 0 && correctIds.length === 0) {
          totalSeen++;
          correctCount++;
          continue;
        }
        if (sel.length > 0) {
          totalSeen++;
          const selSet = new Set(sel);
          const isCorrect =
            sel.length === correctIds.length &&
            [...selSet].every((id) => correctSet.has(id));
          if (isCorrect) correctCount++;
        }
      }
      const correct_rate =
        totalSeen > 0 ? Math.round((correctCount / totalSeen) * 100) : 0;
      questions_insights.push({ question_id: q.id, correct_rate });
    }
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Quiz stats retrieved successfully",
    data: {
      quiz_id: quizId,
      submitted_attempts,
      average_score,
      max_possible_score,
      participation: {
        total_enrolled,
        total_attempted,
        completion_rate,
      },
      distribution,
      students,
      pagination: { page, limit, total: totalRows },
      questions_insights,
    },
  });
});

export const getMyLatestQuizAttempt = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const quizId = Number(req.params.quizId);

  if (userType !== "student") {
    throw new ErrorClass(
      "Only students can view their latest quiz attempt",
      403
    );
  }
  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (!Number.isInteger(quizId) || quizId <= 0) {
    throw new ErrorClass("Invalid quiz id", 400);
  }

  // Ensure quiz exists and student has access (enrolled via module->course)
  const quiz = await Quiz.findByPk(quizId);
  if (!quiz) {
    throw new ErrorClass("Quiz not found", 404);
  }

  // Get latest attempt for this student+quiz (prefer submitted, else in_progress by most recent start)
  let attempt = await QuizAttempts.findOne({
    where: { quiz_id: quizId, student_id: studentId, status: "submitted" },
    order: [["submitted_at", "DESC"]],
  });

  if (!attempt) {
    attempt = await QuizAttempts.findOne({
      where: { quiz_id: quizId, student_id: studentId },
      order: [["started_at", "DESC"]],
    });
  }
  if (!attempt) {
    throw new ErrorClass("No attempt found for this quiz", 404);
  }

  // Load questions only (ordered)
  const questions = await QuizQuestions.findAll({
    where: { quiz_id: quizId },
    order: [["order", "ASC"]],
  });

  // Load options separately and group by question_id
  const questionIds = questions.map((q) => q.id);
  const optionsByQuestionId = new Map();
  if (questionIds.length > 0) {
    const opts = await QuizOptions.findAll({
      where: { question_id: { [Op.in]: questionIds } },
      order: [["order", "ASC"]],
    });
    for (const opt of opts) {
      const list = optionsByQuestionId.get(opt.question_id) || [];
      list.push(opt);
      optionsByQuestionId.set(opt.question_id, list);
    }
  }

  // Load student's saved answers for the attempt
  const answers = await QuizAnswers.findAll({
    where: { attempt_id: attempt.id },
  });

  const questionIdToSelected = new Map();
  for (const ans of answers) {
    const arr = questionIdToSelected.get(ans.question_id) || [];
    if (typeof ans.selected_option_id === "number")
      arr.push(ans.selected_option_id);
    questionIdToSelected.set(ans.question_id, arr);
  }

  let totalScore = 0;
  let maxPossible = 0;

  const questionViews = questions.map((q) => {
    const optionList = optionsByQuestionId.get(q.id) || [];
    const correctIds = optionList.filter((o) => o.is_correct).map((o) => o.id);
    const selectedIds = questionIdToSelected.get(q.id) || [];
    const selectedSet = new Set(selectedIds);
    const correctSet = new Set(correctIds);
    const isCorrect =
      selectedIds.length === correctIds.length &&
      [...selectedSet].every((id) => correctSet.has(id));

    const points = Number(q.points || 0);
    maxPossible += points;
    const earned = isCorrect ? points : 0;
    totalScore += earned;

    return {
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      points: points,
      options: optionList.map((opt) => ({
        id: opt.id,
        option_text: opt.option_text,
        is_correct: !!opt.is_correct,
      })),
      student_selected_option_ids: selectedIds,
      is_student_correct: isCorrect,
      points_earned: earned,
    };
  });

  const percentage =
    maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;

  res.status(200).json({
    status: true,
    code: 200,
    message: "Latest attempt",
    data: {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        module_id: quiz.module_id,
        duration_minutes: quiz.duration_minutes,
        attempts_allowed: quiz.attempts_allowed,
      },
      attempt: {
        id: attempt.id,
        status: attempt.status,
        total_score: attempt.total_score ?? totalScore,
        max_possible_score: attempt.max_possible_score ?? maxPossible,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
      },
      questions: questionViews,
      summary: {
        total_score: totalScore,
        max_possible_score: maxPossible,
        percentage,
      },
    },
  });
});

export const updateQuizAttempt = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const quizId = Number(req.params.quizId);

  if (!canManageQuizzes(userType)) {
    throw new ErrorClass(
      "Only authorized tutors, staff, and admins can update quizzes",
      403
    );
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

  // Verify user can modify this quiz (admin can modify all, staff only their own)
  const accessCheck = await canModifyQuiz(userType, userId, quizId, req.user);
  if (!accessCheck.allowed) {
    throw new ErrorClass("You don't have permission to modify this quiz", 403);
  }

  const module = await Modules.findByPk(quiz.module_id);
  if (!module) {
    throw new ErrorClass("Module not found", 404);
  }

  // Store original values for audit log
  const originalValues = {
    title: quiz.title,
    status: quiz.status,
  };

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
    const deletedQuestionIds = [];
    const upsertedQuestions = [];

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
            deletedQuestionIds.push(existingQ.id);
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

        // Track upserted questions for sync
        upsertedQuestions.push(questionRecord.id);
      }
    }

    await trx.commit();

    // Sync deleted questions (remove from exam bank)
    for (const qId of deletedQuestionIds) {
      deleteQuizQuestionFromBank(qId).catch((err) =>
        console.error("Failed to delete question from bank:", err)
      );
    }

    // Sync upserted questions (add/update in exam bank)
    for (const qId of upsertedQuestions) {
      const q = await QuizQuestions.findByPk(qId, {
        include: [{ model: QuizOptions, as: "options" }],
      });
      if (q) {
        syncQuizQuestionToBank(q, q.options || []).catch((err) =>
          console.error("Failed to sync question to bank:", err)
        );
      }
    }

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

    // Log admin activity if admin modified staff-created quiz
    if (
      userType === "admin" &&
      accessCheck.isAdminModification &&
      accessCheck.originalCreatorId !== userId
    ) {
      try {
        await logAdminActivity(userId, "updated_quiz", "quiz", quizId, {
          module_id: quiz.module_id,
          course_id: accessCheck.courseId,
          original_creator_id: accessCheck.originalCreatorId,
          changes: {
            before: originalValues,
            after: {
              title: quizPayload?.title || originalValues.title,
              status: quizPayload?.status || originalValues.status,
            },
          },
        });
      } catch (logError) {
        console.error("Error logging admin activity:", logError);
      }
    }

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

  if (!canManageQuizzes(userType)) {
    throw new ErrorClass(
      "Only authorized tutors, staff, and admins can delete quizzes",
      403
    );
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

  // Verify user can modify this quiz (admin can modify all, staff only their own)
  const accessCheck = await canModifyQuiz(userType, userId, quizId, req.user);
  if (!accessCheck.allowed) {
    throw new ErrorClass("You don't have permission to delete this quiz", 403);
  }

  const module = await Modules.findByPk(quiz.module_id);
  if (!module) {
    throw new ErrorClass("Module not found", 404);
  }

  // Store quiz info for audit log before deletion
  const quizInfo = {
    id: quiz.id,
    title: quiz.title,
    module_id: quiz.module_id,
    course_id: accessCheck.courseId,
    original_creator_id: accessCheck.originalCreatorId,
  };

  const trx = await dbLibrary.transaction();
  try {
    // 1) Load related entity ids
    const questions = await QuizQuestions.findAll({
      where: { quiz_id: quizId },
      attributes: ["id"],
      transaction: trx,
    });
    const questionIds = questions.map((q) => q.id);

    const attempts = await QuizAttempts.findAll({
      where: { quiz_id: quizId },
      attributes: ["id"],
      transaction: trx,
    });
    const attemptIds = attempts.map((a) => a.id);

    // 2) Delete children in correct order
    if (attemptIds.length > 0) {
      await QuizAnswers.destroy({
        where: { attempt_id: { [Op.in]: attemptIds } },
        transaction: trx,
      });
    }

    await QuizAttempts.destroy({
      where: { quiz_id: quizId },
      transaction: trx,
    });

    if (questionIds.length > 0) {
      await QuizOptions.destroy({
        where: { question_id: { [Op.in]: questionIds } },
        transaction: trx,
      });
    }

    await QuizQuestions.destroy({
      where: { quiz_id: quizId },
      transaction: trx,
    });

    // 3) Finally, delete the quiz
    await Quiz.destroy({ where: { id: quizId }, transaction: trx });

    await trx.commit();

    // Sync deleted questions (remove from exam bank)
    for (const qId of questionIds) {
      deleteQuizQuestionFromBank(qId).catch((err) =>
        console.error("Failed to delete question from bank:", err)
      );
    }

    // Log admin activity if admin deleted staff-created quiz
    if (
      userType === "admin" &&
      accessCheck.isAdminModification &&
      accessCheck.originalCreatorId !== userId
    ) {
      try {
        await logAdminActivity(userId, "deleted_quiz", "quiz", quizId, {
          module_id: quizInfo.module_id,
          course_id: quizInfo.course_id,
          title: quizInfo.title,
          original_creator_id: quizInfo.original_creator_id,
        });
      } catch (logError) {
        console.error("Error logging admin activity:", logError);
      }
    }
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
