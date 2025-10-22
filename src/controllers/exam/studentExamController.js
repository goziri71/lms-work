import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import {
  Exam,
  ExamItem,
  ExamAttempt,
  ExamAnswerObjective,
  ExamAnswerTheory,
  QuestionBank,
  QuestionObjective,
  QuestionTheory,
} from "../../models/exams/index.js";
import { CourseReg } from "../../models/course_reg.js";
import {
  startExamAttempt,
  getAttemptQuestions,
} from "../../services/examAttemptService.js";
import { Op } from "sequelize";
import {
  getPaginationParams,
  paginatedResponse,
} from "../../utils/pagination.js";
import { storeExamStartIP } from "../../middlewares/ipTracker.js";

/**
 * GET AVAILABLE EXAMS (Student)
 * GET /api/student/exams
 */
export const getStudentExams = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  const { academic_year, semester } = req.query;
  const { page, limit, offset } = getPaginationParams(req);

  // Get student's enrolled courses
  const where = { student_id: studentId };
  if (academic_year) where.academic_year = academic_year;
  if (semester) where.semester = semester;

  const enrollments = await CourseReg.findAll({
    where,
    attributes: ["course_id"],
  });

  const courseIds = enrollments.map((e) => e.course_id);

  if (courseIds.length === 0) {
    return res.status(200).json({
      status: true,
      code: 200,
      message: "No exams available",
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  }

  // Get published exams for enrolled courses
  const { count, rows: exams } = await Exam.findAndCountAll({
    where: {
      course_id: { [Op.in]: courseIds },
      visibility: "published",
    },
    order: [["start_at", "DESC"]],
    limit,
    offset,
  });

  res
    .status(200)
    .json(
      paginatedResponse(
        exams,
        count,
        page,
        limit,
        "Exams retrieved successfully"
      )
    );
});

/**
 * START EXAM ATTEMPT (Student)
 * POST /api/student/exams/:examId/start
 */
export const startExam = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const examId = Number(req.params.examId);

  if (userType !== "student") {
    throw new ErrorClass("Only students can start exams", 403);
  }

  const exam = await Exam.findByPk(examId);
  if (!exam) {
    throw new ErrorClass("Exam not found", 404);
  }

  if (exam.visibility !== "published") {
    throw new ErrorClass("Exam is not available", 403);
  }

  // Verify student is enrolled in the course
  const enrollment = await CourseReg.findOne({
    where: {
      student_id: studentId,
      course_id: exam.course_id,
      academic_year: exam.academic_year,
      semester: exam.semester,
    },
  });

  if (!enrollment) {
    throw new ErrorClass("You are not enrolled in this course", 403);
  }

  // Check time window
  const now = new Date();
  if (exam.start_at && now < new Date(exam.start_at)) {
    throw new ErrorClass("Exam has not started yet", 403);
  }
  if (exam.end_at && now > new Date(exam.end_at)) {
    throw new ErrorClass("Exam has ended", 403);
  }

  // Check attempt limit (default: max 3 attempts per exam)
  const MAX_ATTEMPTS = exam.max_attempts || 3;
  const existingAttempts = await ExamAttempt.count({
    where: {
      exam_id: examId,
      student_id: studentId,
    },
  });

  if (existingAttempts >= MAX_ATTEMPTS) {
    throw new ErrorClass(
      `Maximum attempt limit reached (${MAX_ATTEMPTS} attempts allowed)`,
      403
    );
  }

  // Check for existing in-progress attempt
  const inProgressAttempt = await ExamAttempt.findOne({
    where: {
      exam_id: examId,
      student_id: studentId,
      status: "in_progress",
    },
  });

  if (inProgressAttempt) {
    // Return existing attempt instead of creating new one
    const items = await getAttemptQuestions(inProgressAttempt.id);
    const questions = items.map((item) => ({
      exam_item_id: item.id,
      order: item.order,
      question_type: item.question?.question_type,
      question_text:
        item.question?.objective?.question_text ||
        item.question?.theory?.question_text,
      options: item.question?.objective?.options || null,
      max_marks:
        item.question?.objective?.marks ||
        item.question?.theory?.max_marks ||
        null,
      image_url:
        item.question?.objective?.image_url ||
        item.question?.theory?.image_url ||
        null,
      video_url:
        item.question?.objective?.video_url ||
        item.question?.theory?.video_url ||
        null,
    }));

    return res.status(200).json({
      status: true,
      code: 200,
      message: "Resuming existing exam attempt",
      data: {
        attempt_id: inProgressAttempt.id,
        exam_id: inProgressAttempt.exam_id,
        started_at: inProgressAttempt.started_at,
        duration_minutes: exam.duration_minutes,
        remaining_attempts: MAX_ATTEMPTS - existingAttempts,
        questions,
      },
    });
  }

  // Start new attempt (handles random selection if needed)
  const { attempt, isNew } = await startExamAttempt(examId, studentId);

  // Store exam start IP for security tracking
  const startIP =
    req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  await storeExamStartIP(attempt.id, startIP);

  // Get questions for this attempt (student view - no correct answers)
  const items = await getAttemptQuestions(attempt.id);
  const questions = items.map((item) => ({
    exam_item_id: item.id,
    order: item.order,
    question_type: item.question.question_type,
    question_text:
      item.question.objective?.question_text ||
      item.question.theory?.question_text,
    options: item.question.objective?.options || null,
    max_marks:
      item.question.objective?.marks || item.question.theory?.max_marks,
    image_url:
      item.question.objective?.image_url || item.question.theory?.image_url,
    video_url:
      item.question.objective?.video_url || item.question.theory?.video_url,
  }));

  res.status(200).json({
    status: true,
    code: 200,
    message: isNew ? "Exam started successfully" : "Exam resumed",
    data: {
      attempt_id: attempt.id,
      exam_id: exam.id,
      started_at: attempt.started_at,
      duration_minutes: exam.duration_minutes,
      remaining_attempts: MAX_ATTEMPTS - existingAttempts - 1,
      questions,
    },
  });
});

/**
 * SUBMIT ANSWER (Student - auto-save during exam)
 * POST /api/student/exams/attempts/:attemptId/answer
 */
export const submitAnswer = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const attemptId = Number(req.params.attemptId);

  if (userType !== "student") {
    throw new ErrorClass("Only students can submit answers", 403);
  }

  const { exam_item_id, selected_option, answer_text, file_url } = req.body;

  if (!exam_item_id) {
    throw new ErrorClass("exam_item_id is required", 400);
  }

  const attempt = await ExamAttempt.findByPk(attemptId, {
    include: [{ model: Exam, as: "exam" }],
  });

  if (!attempt || attempt.student_id !== studentId) {
    throw new ErrorClass("Attempt not found or access denied", 403);
  }

  if (attempt.status !== "in_progress") {
    throw new ErrorClass("Exam already submitted", 400);
  }

  // Get exam item
  const examItem = await ExamItem.findByPk(exam_item_id, {
    include: [
      {
        model: QuestionBank,
        as: "question",
        include: ["objective", "theory"],
      },
    ],
  });

  if (!examItem || examItem.exam_id !== attempt.exam_id) {
    throw new ErrorClass("Question not found in this exam", 404);
  }

  const questionType = examItem.question.question_type;

  if (questionType === "objective") {
    // Upsert objective answer
    const correctOption = examItem.question.objective.correct_option;
    const isCorrect = selected_option === correctOption;
    const awardedScore = isCorrect ? examItem.question.objective.marks : 0;

    await ExamAnswerObjective.upsert({
      attempt_id: attemptId,
      exam_item_id,
      selected_option,
      is_correct: isCorrect,
      awarded_score: awardedScore,
      answered_at: new Date(),
    });

    res.status(200).json({
      status: true,
      code: 200,
      message: "Answer saved",
      data: { is_correct: isCorrect, awarded_score: awardedScore },
    });
  } else {
    // Upsert theory answer
    await ExamAnswerTheory.upsert({
      attempt_id: attemptId,
      exam_item_id,
      answer_text,
      file_url,
      answered_at: new Date(),
    });

    res.status(200).json({
      status: true,
      code: 200,
      message: "Answer saved (pending grading)",
    });
  }
});

/**
 * SUBMIT EXAM (Student - finalize attempt)
 * POST /api/student/exams/attempts/:attemptId/submit
 */
export const submitExam = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const attemptId = Number(req.params.attemptId);

  if (userType !== "student") {
    throw new ErrorClass("Only students can submit exams", 403);
  }

  const attempt = await ExamAttempt.findByPk(attemptId, {
    include: [{ model: Exam, as: "exam" }],
  });

  if (!attempt || attempt.student_id !== studentId) {
    throw new ErrorClass("Attempt not found or access denied", 403);
  }

  if (attempt.status !== "in_progress") {
    throw new ErrorClass("Exam already submitted", 400);
  }

  // Calculate total score from objective answers
  const objectiveAnswers = await ExamAnswerObjective.findAll({
    where: { attempt_id: attemptId },
  });

  const objectiveScore = objectiveAnswers.reduce(
    (sum, ans) => sum + Number(ans.awarded_score || 0),
    0
  );

  // Theory answers are not graded yet, so max_score will be updated when graded
  const theoryAnswers = await ExamAnswerTheory.findAll({
    where: { attempt_id: attemptId },
    include: [
      {
        model: ExamItem,
        as: "examItem",
        include: [
          {
            model: QuestionBank,
            as: "question",
            include: [{ model: QuestionTheory, as: "theory" }],
          },
        ],
      },
    ],
  });

  const maxTheoryScore = theoryAnswers.reduce(
    (sum, ans) => sum + Number(ans.examItem?.question?.theory?.max_marks || 0),
    0
  );

  const totalObjectiveMaxScore = objectiveAnswers.length * 1; // Assuming 1 mark per objective question (can be dynamic)

  await attempt.update({
    submitted_at: new Date(),
    status: theoryAnswers.length > 0 ? "submitted" : "graded",
    total_score: objectiveScore,
    max_score: totalObjectiveMaxScore + maxTheoryScore,
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Exam submitted successfully",
    data: {
      attempt_id: attempt.id,
      total_score: objectiveScore,
      status: attempt.status,
    },
  });
});

/**
 * GET STUDENT'S ATTEMPT DETAILS
 * GET /api/student/exams/attempts/:attemptId
 */
export const getAttemptDetails = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const attemptId = Number(req.params.attemptId);

  if (userType !== "student") {
    throw new ErrorClass("Only students can view attempt details", 403);
  }

  const attempt = await ExamAttempt.findByPk(attemptId, {
    include: [
      { model: Exam, as: "exam" },
      {
        model: ExamAnswerObjective,
        as: "objectiveAnswers",
        include: [
          {
            model: ExamItem,
            as: "examItem",
            include: [
              {
                model: QuestionBank,
                as: "question",
                include: [{ model: QuestionObjective, as: "objective" }],
              },
            ],
          },
        ],
      },
      {
        model: ExamAnswerTheory,
        as: "theoryAnswers",
        include: [
          {
            model: ExamItem,
            as: "examItem",
            include: [
              {
                model: QuestionBank,
                as: "question",
                include: [{ model: QuestionTheory, as: "theory" }],
              },
            ],
          },
        ],
      },
    ],
  });

  if (!attempt || attempt.student_id !== studentId) {
    throw new ErrorClass("Attempt not found or access denied", 403);
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Attempt details retrieved successfully",
    data: attempt,
  });
});
