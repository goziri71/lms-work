import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import {
  Exam,
  ExamItem,
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

/**
 * CREATE EXAM (Staff only)
 * POST /api/exams
 */
export const createExam = TryCatchFunction(async (req, res) => {
  console.log("📝 Create exam endpoint called");
  const staffId = Number(req.user?.id);
  const userType = req.user?.userType;
  console.log("👤 User:", { staffId, userType });

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can create exams", 403);
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

  // Verify staff owns the course
  console.log("🔍 Checking course ownership...");
  const course = await Courses.findOne({
    where: { id: course_id, staff_id: staffId },
  });
  if (!course) {
    throw new ErrorClass("Course not found or access denied", 403);
  }
  console.log("✅ Course found:", course.id);

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
    created_by: staffId,
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
  res.status(201).json({
    status: true,
    code: 201,
    message: "Exam created successfully",
    data: exam,
  });
});

/**
 * GET ALL EXAMS (Staff - for their courses)
 * GET /api/exams
 */
export const getStaffExams = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can access this endpoint", 403);
  }

  const { course_id, academic_year, semester, visibility } = req.query;
  const { page, limit, offset } = getPaginationParams(req);

  // Get courses owned by staff
  const staffCourses = await Courses.findAll({
    where: { staff_id: staffId },
    attributes: ["id"],
  });
  const courseIds = staffCourses.map((c) => c.id);

  const where = { course_id: { [Op.in]: courseIds } };
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
 * GET SINGLE EXAM (Staff view - includes all details)
 * GET /api/exams/:examId
 */
export const getExamById = TryCatchFunction(async (req, res) => {
  console.log("🔍 Get exam by ID endpoint called");
  const staffId = Number(req.user?.id);
  const userType = req.user?.userType;
  const examId = Number(req.params.examId);
  console.log("👤 User:", { staffId, userType, examId });

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can access this endpoint", 403);
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

  // Verify staff owns the course
  console.log("🔍 Checking course ownership...");
  const course = await Courses.findOne({
    where: { id: exam.course_id, staff_id: staffId },
  });
  if (!course) {
    console.log("❌ Access denied - course not owned by staff");
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
 * UPDATE EXAM (Staff only)
 * PUT /api/exams/:examId
 */
export const updateExam = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id);
  const userType = req.user?.userType;
  const examId = Number(req.params.examId);

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can update exams", 403);
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

  res.status(200).json({
    status: true,
    code: 200,
    message: "Exam updated successfully",
    data: exam,
  });
});

/**
 * DELETE EXAM (Staff only)
 * DELETE /api/exams/:examId
 */
export const deleteExam = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id);
  const userType = req.user?.userType;
  const examId = Number(req.params.examId);

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can delete exams", 403);
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

  await exam.destroy(); // Cascade will handle items, attempts, answers

  res.status(200).json({
    status: true,
    code: 200,
    message: "Exam deleted successfully",
  });
});

/**
 * GET EXAM BANK QUESTIONS (Staff view for exam creation)
 * GET /api/exams/bank/questions
 */
export const getBankQuestions = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "staff") {
    throw new ErrorClass("Only staff can access question bank", 403);
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

  // Verify staff owns the course
  const course = await Courses.findOne({
    where: { id: course_id, staff_id: staffId },
  });
  if (!course) {
    throw new ErrorClass("Course not found or access denied", 403);
  }

  const where = { course_id: Number(course_id), status };
  if (question_type) where.question_type = question_type;
  if (difficulty) where.difficulty = difficulty;

  const { count, rows: questions } = await QuestionBank.findAndCountAll({
    where,
    include: [
      { model: QuestionObjective, as: "objective" },
      { model: QuestionTheory, as: "theory" },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
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
