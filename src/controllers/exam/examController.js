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
import { Courses } from "../../models/course/courses.js";
import { Op } from "sequelize";
import {
  getPaginationParams,
  paginatedResponse,
} from "../../utils/pagination.js";
import {
  canAccessCourse,
  canModifyExam,
  getCreatorId,
} from "../../utils/examAccessControl.js";
import { logAdminActivity } from "../../middlewares/adminAuthorize.js";
import { dbLibrary } from "../../database/database.js";

/**
 * CREATE EXAM (Staff and Admin)
 * POST /api/exams
 */
export const createExam = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can create exams", 403);
  }

  const {
    course_id,
    academic_year,
    semester,
    title,
    instructions,
    start_at,
    end_at,
    duration_minutes,
    visibility = "draft",
    randomize = true,
    exam_type = "mixed",
    selection_mode = "random",
    objective_count = 0,
    theory_count = 0,
    manual_question_ids, // Array of question_bank_ids for manual mode
  } = req.body;

  console.log("📋 Request body:", {
    course_id,
    academic_year,
    semester,
    title,
    exam_type,
  });

  if (!course_id || !academic_year || !semester || !title) {
    throw new ErrorClass(
      "course_id, academic_year, semester, and title are required",
      400
    );
  }

  // Verify user can access the course (admin can access all, staff only their own)
  console.log("🔍 Checking course access...");
  const hasAccess = await canAccessCourse(userType, userId, course_id);
  if (!hasAccess) {
    throw new ErrorClass("Course not found or access denied", 403);
  }
  console.log("✅ Course access granted");

  // Get creator ID (admin ID for admins, staff ID for staff)
  const creatorId = getCreatorId(userType, userId);

  // Create exam
  console.log("💾 Creating exam...");
  const exam = await Exam.create({
    course_id,
    academic_year,
    semester,
    title,
    instructions,
    start_at,
    end_at,
    duration_minutes: duration_minutes || 60,
    visibility,
    randomize,
    exam_type,
    selection_mode,
    objective_count,
    theory_count,
    created_by: creatorId,
  });

  console.log("✅ Exam created with ID:", exam.id);

  // If manual mode, add pre-selected questions
  if (selection_mode === "manual" && Array.isArray(manual_question_ids)) {
    console.log("📝 Adding manual questions:", manual_question_ids.length);
    for (let i = 0; i < manual_question_ids.length; i++) {
      await ExamItem.create({
        exam_id: exam.id,
        attempt_id: null, // Manual mode = shared for all students
        question_bank_id: manual_question_ids[i],
        order: i + 1,
      });
    }
  }

  console.log("✅ Exam creation completed successfully");

  // Log admin activity if created by admin
  if (userType === "admin") {
    try {
      await logAdminActivity(
        userId,
        "created_exam",
        "exam",
        exam.id,
        {
          course_id: course_id,
          title: title,
          exam_type: exam_type,
          academic_year: academic_year,
          semester: semester,
        }
      );
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: "Exam created successfully",
    data: exam,
  });
});

/**
 * GET ALL EXAMS (Staff - for their courses, Admin - all courses)
 * GET /api/exams
 */
export const getStaffExams = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can access this endpoint", 403);
  }

  const { course_id, academic_year, semester, visibility } = req.query;
  const { page, limit, offset } = getPaginationParams(req);

  // For admins: get all courses, for staff: get only their courses
  let courseIds = [];
  if (userType === "admin") {
    // Admin can see all courses
    const allCourses = await Courses.findAll({
      attributes: ["id"],
    });
    courseIds = allCourses.map((c) => c.id);
  } else {
    // Staff can only see their own courses
    const staffCourses = await Courses.findAll({
      where: { staff_id: userId },
      attributes: ["id"],
    });
    courseIds = staffCourses.map((c) => c.id);
  }

  const where = courseIds.length > 0 ? { course_id: { [Op.in]: courseIds } } : {};
  if (course_id) where.course_id = Number(course_id);
  if (academic_year) where.academic_year = academic_year;
  if (semester) where.semester = semester;
  if (visibility) where.visibility = visibility;

  const { count, rows: exams } = await Exam.findAndCountAll({
    where,
    order: [["created_at", "DESC"]],
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
 * GET SINGLE EXAM (Staff and Admin view - includes all details)
 * GET /api/exams/:examId
 */
export const getExamById = TryCatchFunction(async (req, res) => {
  console.log("🔍 Get exam by ID endpoint called");
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const examId = Number(req.params.examId);
  console.log("👤 User:", { userId, userType, examId });

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can access this endpoint", 403);
  }

  console.log("📚 Fetching exam with includes...");
  const exam = await Exam.findByPk(examId, {
    include: [
      {
        model: ExamItem,
        as: "items",
        where: { attempt_id: null }, // Manual mode items only
        required: false,
        include: [
          {
            model: QuestionBank,
            as: "question",
            include: [
              { model: QuestionObjective, as: "objective" },
              { model: QuestionTheory, as: "theory" },
            ],
          },
        ],
      },
    ],
  });

  if (!exam) {
    console.log("❌ Exam not found");
    throw new ErrorClass("Exam not found", 404);
  }
  console.log("✅ Exam found:", exam.id);

  // Verify user can access the course (admin can access all, staff only their own)
  console.log("🔍 Checking course access...");
  const hasAccess = await canAccessCourse(userType, userId, exam.course_id);
  if (!hasAccess) {
    console.log("❌ Access denied");
    throw new ErrorClass("Access denied", 403);
  }
  console.log("✅ Access granted");

  res.status(200).json({
    status: true,
    code: 200,
    message: "Exam retrieved successfully",
    data: exam,
  });
});

/**
 * UPDATE EXAM (Staff and Admin)
 * PUT /api/exams/:examId
 */
export const updateExam = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const examId = Number(req.params.examId);

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can update exams", 403);
  }

  // Check if user can modify this exam
  const accessCheck = await canModifyExam(userType, userId, examId);
  if (!accessCheck.allowed) {
    throw new ErrorClass("Access denied", 403);
  }

  const exam = accessCheck.exam;

  // Store original values for audit log
  const originalValues = {
    title: exam.title,
    visibility: exam.visibility,
    exam_type: exam.exam_type,
  };

  const {
    title,
    instructions,
    start_at,
    end_at,
    duration_minutes,
    visibility,
    randomize,
    exam_type,
    objective_count,
    theory_count,
  } = req.body;

  const updates = {};
  if (title !== undefined) updates.title = title;
  if (instructions !== undefined) updates.instructions = instructions;
  if (start_at !== undefined) updates.start_at = start_at;
  if (end_at !== undefined) updates.end_at = end_at;
  if (duration_minutes !== undefined)
    updates.duration_minutes = duration_minutes;
  if (visibility !== undefined) updates.visibility = visibility;
  if (randomize !== undefined) updates.randomize = randomize;
  if (exam_type !== undefined) updates.exam_type = exam_type;
  if (objective_count !== undefined) updates.objective_count = objective_count;
  if (theory_count !== undefined) updates.theory_count = theory_count;

  await exam.update(updates);

  // Log admin activity if admin modified staff-created exam
  if (userType === "admin" && accessCheck.isAdminModification && accessCheck.originalCreatorId !== userId) {
    try {
      await logAdminActivity(
        userId,
        "updated_exam",
        "exam",
        examId,
        {
          course_id: exam.course_id,
          original_creator_id: accessCheck.originalCreatorId,
          changes: {
            before: originalValues,
            after: {
              title: updates.title || originalValues.title,
              visibility: updates.visibility || originalValues.visibility,
              exam_type: updates.exam_type || originalValues.exam_type,
            },
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
    message: "Exam updated successfully",
    data: exam,
  });
});

/**
 * DELETE EXAM (Staff and Admin)
 * DELETE /api/exams/:examId
 */
export const deleteExam = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const examId = Number(req.params.examId);

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can delete exams", 403);
  }

  // Check if user can modify this exam
  const accessCheck = await canModifyExam(userType, userId, examId);
  if (!accessCheck.allowed) {
    throw new ErrorClass("Access denied", 403);
  }

  const exam = accessCheck.exam;

  // Store exam info for audit log before deletion
  const examInfo = {
    id: exam.id,
    title: exam.title,
    course_id: exam.course_id,
    original_creator_id: accessCheck.originalCreatorId,
  };

  // Use transaction to ensure all related records are deleted in correct order
  const trx = await dbLibrary.transaction();
  try {
    // 1) Load related entity ids
    const examItems = await ExamItem.findAll({
      where: { exam_id: examId },
      attributes: ["id"],
      transaction: trx,
    });
    const examItemIds = examItems.map((item) => item.id);

    const examAttempts = await ExamAttempt.findAll({
      where: { exam_id: examId },
      attributes: ["id"],
      transaction: trx,
    });
    const attemptIds = examAttempts.map((attempt) => attempt.id);

    // 2) Delete children in correct order (respecting foreign key constraints)
    // Delete answers that reference exam_items
    if (examItemIds.length > 0) {
      await ExamAnswerObjective.destroy({
        where: { exam_item_id: { [Op.in]: examItemIds } },
        transaction: trx,
      });

      await ExamAnswerTheory.destroy({
        where: { exam_item_id: { [Op.in]: examItemIds } },
        transaction: trx,
      });
    }

    // Delete answers that reference exam_attempts (in case there are any orphaned)
    if (attemptIds.length > 0) {
      await ExamAnswerObjective.destroy({
        where: { attempt_id: { [Op.in]: attemptIds } },
        transaction: trx,
      });

      await ExamAnswerTheory.destroy({
        where: { attempt_id: { [Op.in]: attemptIds } },
        transaction: trx,
      });
    }

    // Delete exam attempts
    if (attemptIds.length > 0) {
      await ExamAttempt.destroy({
        where: { id: { [Op.in]: attemptIds } },
        transaction: trx,
      });
    }

    // Delete exam items
    if (examItemIds.length > 0) {
      await ExamItem.destroy({
        where: { id: { [Op.in]: examItemIds } },
        transaction: trx,
      });
    }

    // 3) Finally, delete the exam
    await Exam.destroy({ where: { id: examId }, transaction: trx });

    await trx.commit();

    // Log admin activity if admin deleted staff-created exam
    if (userType === "admin" && accessCheck.isAdminModification && accessCheck.originalCreatorId !== userId) {
      try {
        await logAdminActivity(
          userId,
          "deleted_exam",
          "exam",
          examId,
          {
            course_id: examInfo.course_id,
            title: examInfo.title,
            original_creator_id: examInfo.original_creator_id,
          }
        );
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
    message: "Exam deleted successfully",
  });
});

/**
 * GET EXAM BANK QUESTIONS (Staff and Admin view for exam creation)
 * GET /api/exams/bank/questions
 */
export const getBankQuestions = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can access question bank", 403);
  }

  const {
    course_id,
    question_type,
    difficulty,
    status = "approved",
  } = req.query;
  const { page, limit, offset } = getPaginationParams(req);

  if (!course_id) {
    throw new ErrorClass("course_id is required", 400);
  }

  // Validate and convert course_id to number
  const courseIdNum = Number(course_id);
  if (isNaN(courseIdNum) || courseIdNum <= 0) {
    throw new ErrorClass("Invalid course_id. Must be a positive number", 400);
  }

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(userType, userId, courseIdNum);
  if (!hasAccess) {
    throw new ErrorClass("Course not found or access denied", 403);
  }

  const where = { course_id: courseIdNum, status };
  if (question_type) where.question_type = question_type;
  if (difficulty) where.difficulty = difficulty;

  const { count, rows: questions } = await QuestionBank.findAndCountAll({
    where,
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
    order: [["id", "DESC"]], // Order by ID instead of created_at to avoid ambiguity
    limit: limit || 20,
    offset: offset || 0,
  });

  res
    .status(200)
    .json(
      paginatedResponse(
        questions,
        count,
        page,
        limit,
        "Bank questions retrieved successfully"
      )
    );
});
