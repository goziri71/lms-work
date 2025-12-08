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
import {
  getPaginationParams,
  paginatedResponse,
} from "../../utils/pagination.js";
import {
  canAccessCourse,
  canModifyExam,
} from "../../utils/examAccessControl.js";
import { logAdminActivity } from "../../middlewares/adminAuthorize.js";

/**
 * GET ATTEMPTS FOR GRADING (Staff and Admin)
 * GET /api/exams/:examId/attempts
 */
export const getExamAttempts = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const examId = Number(req.params.examId);

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can access grading", 403);
  }

  const exam = await Exam.findByPk(examId);
  if (!exam) {
    throw new ErrorClass("Exam not found", 404);
  }

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(userType, userId, exam.course_id);
  if (!hasAccess) {
    throw new ErrorClass("Access denied", 403);
  }

  const { status } = req.query;
  const { page, limit, offset } = getPaginationParams(req);
  const where = { exam_id: examId };
  if (status) where.status = status;

  const { count, rows: attempts } = await ExamAttempt.findAndCountAll({
    where,
    order: [["submitted_at", "DESC"]],
    limit,
    offset,
  });

  // Fetch student data separately (different database)
  const studentIds = [...new Set(attempts.map((a) => a.student_id))];
  const students = await Students.findAll({
    where: { id: studentIds },
    attributes: ["id", "fname", "lname", "matric_number"],
  });

  // Map students to attempts
  const studentsMap = {};
  students.forEach((s) => {
    studentsMap[s.id] = {
      id: s.id,
      fname: s.fname,
      lname: s.lname,
      matric_number: s.matric_number,
    };
  });

  const attemptsWithStudents = attempts.map((attempt) => ({
    ...attempt.toJSON(),
    student: studentsMap[attempt.student_id] || null,
  }));

  res
    .status(200)
    .json(
      paginatedResponse(
        attemptsWithStudents,
        count,
        page,
        limit,
        "Attempts retrieved successfully"
      )
    );
});

/**
 * GET SINGLE ATTEMPT FOR GRADING (Staff and Admin)
 * GET /api/exams/attempts/:attemptId/grade
 */
export const getAttemptForGrading = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const attemptId = Number(req.params.attemptId);

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can access grading", 403);
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

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(userType, userId, attempt.exam.course_id);
  if (!hasAccess) {
    throw new ErrorClass("Access denied", 403);
  }

  // Fetch student data separately (different database)
  const student = await Students.findByPk(attempt.student_id, {
    attributes: ["id", "fname", "lname", "matric_number", "email"],
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Attempt retrieved for grading",
    data: {
      ...attempt.toJSON(),
      student: student ? student.toJSON() : null,
    },
  });
});

/**
 * GRADE THEORY ANSWER (Staff and Admin)
 * POST /api/exams/answers/theory/:answerId/grade
 */
export const gradeTheoryAnswer = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const answerId = Number(req.params.answerId);

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can grade answers", 403);
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

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(userType, userId, answer.attempt.exam.course_id);
  if (!hasAccess) {
    throw new ErrorClass("Access denied", 403);
  }

  // Get exam info for audit log
  const exam = answer.attempt.exam;
  const accessCheck = await canModifyExam(userType, userId, exam.id);
  const isAdminModification = accessCheck.isAdminModification && accessCheck.originalCreatorId !== userId;

  // Validate score doesn't exceed max
  const maxMarks = answer.examItem.question.theory.max_marks;
  if (awarded_score > maxMarks) {
    throw new ErrorClass(`Score cannot exceed max marks (${maxMarks})`, 400);
  }

  // Store original score for audit log
  const originalScore = answer.awarded_score;

  await answer.update({
    awarded_score,
    feedback,
    graded_by: userId,
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
        graded_by: userId,
      },
      { where: { id: attemptId } }
    );
  }

  // Log admin activity if admin graded staff-created exam
  if (userType === "admin" && isAdminModification) {
    try {
      await logAdminActivity(
        userId,
        "graded_exam_answer",
        "exam_answer",
        answerId,
        {
          exam_id: exam.id,
          course_id: exam.course_id,
          attempt_id: attemptId,
          student_id: answer.attempt.student_id,
          original_creator_id: accessCheck.originalCreatorId,
          changes: {
            before: { awarded_score: originalScore },
            after: { awarded_score: awarded_score },
          },
        }
      );
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Answer graded successfully",
    data: answer,
  });
});

/**
 * BULK GRADE THEORY ANSWERS (Staff and Admin)
 * POST /api/exams/attempts/:attemptId/grade-bulk
 */
export const bulkGradeTheory = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const attemptId = Number(req.params.attemptId);

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can grade answers", 403);
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

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(userType, userId, attempt.exam.course_id);
  if (!hasAccess) {
    throw new ErrorClass("Access denied", 403);
  }

  // Get exam info for audit log
  const accessCheck = await canModifyExam(userType, userId, attempt.exam_id);
  const isAdminModification = accessCheck.isAdminModification && accessCheck.originalCreatorId !== userId;

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
        graded_by: userId,
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

  const totalScore = objectiveScore + theoryScore;

  await attempt.update({
    total_score: totalScore,
    status: "graded",
    graded_at: new Date(),
    graded_by: userId,
  });

  // Reload to get updated values
  await attempt.reload();

  // Log admin activity if admin graded staff-created exam
  if (userType === "admin" && isAdminModification) {
    try {
      await logAdminActivity(
        userId,
        "bulk_graded_exam",
        "exam_attempt",
        attemptId,
        {
          exam_id: attempt.exam_id,
          course_id: attempt.exam.course_id,
          student_id: attempt.student_id,
          original_creator_id: accessCheck.originalCreatorId,
          total_score: totalScore,
          answers_graded: grades.length,
        }
      );
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Answers graded successfully",
    data: {
      attempt_id: attemptId,
      total_score: totalScore,
      objective_score: objectiveScore,
      theory_score: theoryScore,
      status: attempt.status,
    },
  });
});

/**
 * GET EXAM STATISTICS (Staff and Admin)
 * GET /api/exams/:examId/statistics
 */
export const getExamStatistics = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const examId = Number(req.params.examId);

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can view statistics", 403);
  }

  const exam = await Exam.findByPk(examId);
  if (!exam) {
    throw new ErrorClass("Exam not found", 404);
  }

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(userType, userId, exam.course_id);
  if (!hasAccess) {
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
