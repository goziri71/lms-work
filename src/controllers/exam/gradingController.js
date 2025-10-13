import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import {
  Exam,
  ExamAttempt,
  ExamAnswerObjective,
  ExamAnswerTheory,
  ExamItem,
  QuestionBank,
  QuestionTheory,
} from "../../models/exams/index.js";
import { Courses } from "../../models/course/courses.js";
import { Students } from "../../models/auth/student.js";
import { Op } from "sequelize";

/**
 * GET ATTEMPTS FOR GRADING (Staff)
 * GET /api/exams/:examId/attempts
 */
export const getExamAttempts = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id);
  const userType = req.user?.userType;
  const examId = Number(req.params.examId);

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can access grading", 403);
  }

  const exam = await Exam.findByPk(examId);
  if (!exam) {
    throw new ErrorClass("Exam not found", 404);
  }

  // Verify staff owns the course
  const course = await Courses.findOne({
    where: { id: exam.course_id, staff_id: staffId },
  });
  if (!course) {
    throw new ErrorClass("Access denied", 403);
  }

  const { status } = req.query;
  const where = { exam_id: examId };
  if (status) where.status = status;

  const attempts = await ExamAttempt.findAll({
    where,
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "matric_number"],
      },
    ],
    order: [["submitted_at", "DESC"]],
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Attempts retrieved successfully",
    data: attempts,
  });
});

/**
 * GET SINGLE ATTEMPT FOR GRADING (Staff)
 * GET /api/exams/attempts/:attemptId/grade
 */
export const getAttemptForGrading = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id);
  const userType = req.user?.userType;
  const attemptId = Number(req.params.attemptId);

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can access grading", 403);
  }

  const attempt = await ExamAttempt.findByPk(attemptId, {
    include: [
      { model: Exam, as: "exam" },
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "matric_number", "email"],
      },
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
                include: ["objective"],
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
                include: ["theory"],
              },
            ],
          },
        ],
      },
    ],
  });

  if (!attempt) {
    throw new ErrorClass("Attempt not found", 404);
  }

  // Verify staff owns the course
  const course = await Courses.findOne({
    where: { id: attempt.exam.course_id, staff_id: staffId },
  });
  if (!course) {
    throw new ErrorClass("Access denied", 403);
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Attempt retrieved for grading",
    data: attempt,
  });
});

/**
 * GRADE THEORY ANSWER (Staff)
 * POST /api/exams/answers/theory/:answerId/grade
 */
export const gradeTheoryAnswer = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id);
  const userType = req.user?.userType;
  const answerId = Number(req.params.answerId);

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can grade answers", 403);
  }

  const { awarded_score, feedback } = req.body;

  if (typeof awarded_score !== "number" || awarded_score < 0) {
    throw new ErrorClass("awarded_score is required and must be >= 0", 400);
  }

  const answer = await ExamAnswerTheory.findByPk(answerId, {
    include: [
      {
        model: ExamAttempt,
        as: "attempt",
        include: [{ model: Exam, as: "exam" }],
      },
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

  if (!answer) {
    throw new ErrorClass("Answer not found", 404);
  }

  // Verify staff owns the course
  const course = await Courses.findOne({
    where: { id: answer.attempt.exam.course_id, staff_id: staffId },
  });
  if (!course) {
    throw new ErrorClass("Access denied", 403);
  }

  // Validate score doesn't exceed max
  const maxMarks = answer.examItem.question.theory.max_marks;
  if (awarded_score > maxMarks) {
    throw new ErrorClass(`Score cannot exceed max marks (${maxMarks})`, 400);
  }

  await answer.update({
    awarded_score,
    feedback,
    graded_by: staffId,
    graded_at: new Date(),
  });

  // Check if all theory answers are graded, then finalize attempt
  const attemptId = answer.attempt_id;
  const allTheoryAnswers = await ExamAnswerTheory.findAll({
    where: { attempt_id: attemptId },
  });

  const allGraded = allTheoryAnswers.every((a) => a.awarded_score !== null);

  if (allGraded) {
    // Recalculate total score
    const objectiveAnswers = await ExamAnswerObjective.findAll({
      where: { attempt_id: attemptId },
    });
    const objectiveScore = objectiveAnswers.reduce(
      (sum, a) => sum + Number(a.awarded_score || 0),
      0
    );
    const theoryScore = allTheoryAnswers.reduce(
      (sum, a) => sum + Number(a.awarded_score || 0),
      0
    );

    await ExamAttempt.update(
      {
        total_score: objectiveScore + theoryScore,
        status: "graded",
        graded_at: new Date(),
        graded_by: staffId,
      },
      { where: { id: attemptId } }
    );
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Answer graded successfully",
    data: answer,
  });
});

/**
 * BULK GRADE THEORY ANSWERS (Staff)
 * POST /api/exams/attempts/:attemptId/grade-bulk
 */
export const bulkGradeTheory = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id);
  const userType = req.user?.userType;
  const attemptId = Number(req.params.attemptId);

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can grade answers", 403);
  }

  const { grades } = req.body; // Array of { answer_id, awarded_score, feedback }

  if (!Array.isArray(grades) || grades.length === 0) {
    throw new ErrorClass("grades array is required", 400);
  }

  const attempt = await ExamAttempt.findByPk(attemptId, {
    include: [{ model: Exam, as: "exam" }],
  });

  if (!attempt) {
    throw new ErrorClass("Attempt not found", 404);
  }

  // Verify staff owns the course
  const course = await Courses.findOne({
    where: { id: attempt.exam.course_id, staff_id: staffId },
  });
  if (!course) {
    throw new ErrorClass("Access denied", 403);
  }

  // Grade each answer
  for (const { answer_id, awarded_score, feedback } of grades) {
    const answer = await ExamAnswerTheory.findByPk(answer_id, {
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

    if (answer && answer.attempt_id === attemptId) {
      const maxMarks = answer.examItem.question.theory.max_marks;
      const validScore = Math.min(Math.max(awarded_score, 0), maxMarks);

      await answer.update({
        awarded_score: validScore,
        feedback,
        graded_by: staffId,
        graded_at: new Date(),
      });
    }
  }

  // Recalculate total score
  const objectiveAnswers = await ExamAnswerObjective.findAll({
    where: { attempt_id: attemptId },
  });
  const theoryAnswers = await ExamAnswerTheory.findAll({
    where: { attempt_id: attemptId },
  });

  const objectiveScore = objectiveAnswers.reduce(
    (sum, a) => sum + Number(a.awarded_score || 0),
    0
  );
  const theoryScore = theoryAnswers.reduce(
    (sum, a) => sum + Number(a.awarded_score || 0),
    0
  );

  await attempt.update({
    total_score: objectiveScore + theoryScore,
    status: "graded",
    graded_at: new Date(),
    graded_by: staffId,
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Answers graded successfully",
    data: {
      attempt_id: attemptId,
      total_score: objectiveScore + theoryScore,
    },
  });
});

/**
 * GET EXAM STATISTICS (Staff)
 * GET /api/exams/:examId/statistics
 */
export const getExamStatistics = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id);
  const userType = req.user?.userType;
  const examId = Number(req.params.examId);

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can view statistics", 403);
  }

  const exam = await Exam.findByPk(examId);
  if (!exam) {
    throw new ErrorClass("Exam not found", 404);
  }

  // Verify staff owns the course
  const course = await Courses.findOne({
    where: { id: exam.course_id, staff_id: staffId },
  });
  if (!course) {
    throw new ErrorClass("Access denied", 403);
  }

  const attempts = await ExamAttempt.findAll({
    where: { exam_id: examId, status: "graded" },
    attributes: ["total_score", "max_score"],
  });

  const totalAttempts = attempts.length;
  const scores = attempts.map((a) => Number(a.total_score || 0));
  const avgScore =
    totalAttempts > 0
      ? scores.reduce((sum, s) => sum + s, 0) / totalAttempts
      : 0;
  const maxScore = totalAttempts > 0 ? Math.max(...scores) : 0;
  const minScore = totalAttempts > 0 ? Math.min(...scores) : 0;

  res.status(200).json({
    status: true,
    code: 200,
    message: "Statistics retrieved successfully",
    data: {
      exam_id: examId,
      total_attempts: totalAttempts,
      average_score: avgScore.toFixed(2),
      highest_score: maxScore,
      lowest_score: minScore,
    },
  });
});
