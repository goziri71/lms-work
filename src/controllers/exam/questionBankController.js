import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import {
  QuestionBank,
  QuestionObjective,
  QuestionTheory,
} from "../../models/exams/index.js";
import { Courses } from "../../models/course/courses.js";
import {
  canAccessCourse,
  getCreatorId,
} from "../../utils/examAccessControl.js";
import { logAdminActivity } from "../../middlewares/adminAuthorize.js";

/**
 * CREATE OBJECTIVE QUESTION
 * POST /api/exams/bank/questions/objective
 */
export const createObjectiveQuestion = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can create questions", 403);
  }

  const {
    course_id,
    question_text,
    options,
    correct_option,
    marks = 1.0,
    difficulty = "medium",
    topic,
    tags = [],
    image_url,
    video_url,
  } = req.body;

  if (!course_id || !question_text || !options || !correct_option) {
    throw new ErrorClass(
      "course_id, question_text, options, and correct_option are required",
      400
    );
  }

  // Validate options format
  if (!Array.isArray(options) || options.length < 2) {
    throw new ErrorClass("At least 2 options are required", 400);
  }

  // Validate correct option exists
  const optionIds = options.map((opt) => opt.id);
  if (!optionIds.includes(correct_option)) {
    throw new ErrorClass(
      "correct_option must match one of the option IDs",
      400
    );
  }

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(userType, userId, course_id);
  if (!hasAccess) {
    throw new ErrorClass("Course not found or access denied", 403);
  }

  // Get creator ID (admin ID for admins, staff ID for staff)
  const creatorId = getCreatorId(userType, userId);

  // Create question bank entry
  const questionBank = await QuestionBank.create({
    course_id,
    created_by: creatorId,
    question_type: "objective",
    difficulty,
    topic,
    tags,
    status: "approved",
    source_type: "manual",
  });

  // Create objective question
  const objectiveQuestion = await QuestionObjective.create({
    question_bank_id: questionBank.id,
    question_text,
    options,
    correct_option,
    marks,
    image_url,
    video_url,
  });

  // Fetch complete question with bank info
  const completeQuestion = await QuestionBank.findByPk(questionBank.id, {
    include: [{ model: QuestionObjective, as: "objective" }],
  });

  // Log admin activity if created by admin
  if (userType === "admin") {
    try {
      await logAdminActivity(
        userId,
        "created_question",
        "question",
        questionBank.id,
        {
          course_id: course_id,
          question_type: "objective",
          topic: topic,
        }
      );
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: "Objective question created successfully",
    data: completeQuestion,
  });
});

/**
 * CREATE THEORY QUESTION
 * POST /api/exams/bank/questions/theory
 */
export const createTheoryQuestion = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can create questions", 403);
  }

  const {
    course_id,
    question_text,
    max_marks,
    difficulty = "medium",
    topic,
    tags = [],
    rubric_json,
    image_url,
    video_url,
  } = req.body;

  if (!course_id || !question_text || !max_marks) {
    throw new ErrorClass(
      "course_id, question_text, and max_marks are required",
      400
    );
  }

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(userType, userId, course_id);
  if (!hasAccess) {
    throw new ErrorClass("Course not found or access denied", 403);
  }

  // Get creator ID (admin ID for admins, staff ID for staff)
  const creatorId = getCreatorId(userType, userId);

  // Create question bank entry
  const questionBank = await QuestionBank.create({
    course_id,
    created_by: creatorId,
    question_type: "theory",
    difficulty,
    topic,
    tags,
    status: "approved",
    source_type: "manual",
  });

  // Create theory question
  const theoryQuestion = await QuestionTheory.create({
    question_bank_id: questionBank.id,
    question_text,
    max_marks,
    rubric_json,
    image_url,
    video_url,
  });

  // Fetch complete question with bank info
  const completeQuestion = await QuestionBank.findByPk(questionBank.id, {
    include: [{ model: QuestionTheory, as: "theory" }],
  });

  // Log admin activity if created by admin
  if (userType === "admin") {
    try {
      await logAdminActivity(
        userId,
        "created_question",
        "question",
        questionBank.id,
        {
          course_id: course_id,
          question_type: "theory",
          topic: topic,
        }
      );
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: "Theory question created successfully",
    data: completeQuestion,
  });
});

/**
 * UPDATE OBJECTIVE QUESTION
 * PUT /api/exams/bank/questions/objective/:questionId
 */
export const updateObjectiveQuestion = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const questionId = Number(req.params.questionId);

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can update questions", 403);
  }

  const questionBank = await QuestionBank.findByPk(questionId, {
    include: [{ model: QuestionObjective, as: "objective" }],
  });

  if (!questionBank || !questionBank.objective) {
    throw new ErrorClass("Objective question not found", 404);
  }

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(userType, userId, questionBank.course_id);
  if (!hasAccess) {
    throw new ErrorClass("Access denied", 403);
  }

  // Store original values for audit log
  const originalCreatorId = questionBank.created_by;
  const originalValues = {
    question_text: questionBank.objective.question_text,
    correct_option: questionBank.objective.correct_option,
  };

  const {
    question_text,
    options,
    correct_option,
    marks,
    difficulty,
    topic,
    tags,
    image_url,
    video_url,
  } = req.body;

  // Update question bank
  const bankUpdates = {};
  if (difficulty !== undefined) bankUpdates.difficulty = difficulty;
  if (topic !== undefined) bankUpdates.topic = topic;
  if (tags !== undefined) bankUpdates.tags = tags;

  if (Object.keys(bankUpdates).length > 0) {
    await questionBank.update(bankUpdates);
  }

  // Update objective question
  const objectiveUpdates = {};
  if (question_text !== undefined)
    objectiveUpdates.question_text = question_text;
  if (options !== undefined) {
    if (!Array.isArray(options) || options.length < 2) {
      throw new ErrorClass("At least 2 options are required", 400);
    }
    objectiveUpdates.options = options;
  }
  if (correct_option !== undefined) {
    const optionIds = (options || questionBank.objective.options).map(
      (opt) => opt.id
    );
    if (!optionIds.includes(correct_option)) {
      throw new ErrorClass(
        "correct_option must match one of the option IDs",
        400
      );
    }
    objectiveUpdates.correct_option = correct_option;
  }
  if (marks !== undefined) objectiveUpdates.marks = marks;
  if (image_url !== undefined) objectiveUpdates.image_url = image_url;
  if (video_url !== undefined) objectiveUpdates.video_url = video_url;

  if (Object.keys(objectiveUpdates).length > 0) {
    await questionBank.objective.update(objectiveUpdates);
  }

  // Fetch updated question
  const updatedQuestion = await QuestionBank.findByPk(questionId, {
    include: [{ model: QuestionObjective, as: "objective" }],
  });

  // Log admin activity if admin modified staff-created question
  if (userType === "admin" && originalCreatorId !== userId) {
    try {
      await logAdminActivity(
        userId,
        "updated_question",
        "question",
        questionId,
        {
          course_id: questionBank.course_id,
          question_type: "objective",
          original_creator_id: originalCreatorId,
          changes: {
            before: originalValues,
            after: {
              question_text: objectiveUpdates.question_text || originalValues.question_text,
              correct_option: objectiveUpdates.correct_option || originalValues.correct_option,
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
    message: "Objective question updated successfully",
    data: updatedQuestion,
  });
});

/**
 * UPDATE THEORY QUESTION
 * PUT /api/exams/bank/questions/theory/:questionId
 */
export const updateTheoryQuestion = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const questionId = Number(req.params.questionId);

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can update questions", 403);
  }

  const questionBank = await QuestionBank.findByPk(questionId, {
    include: [{ model: QuestionTheory, as: "theory" }],
  });

  if (!questionBank || !questionBank.theory) {
    throw new ErrorClass("Theory question not found", 404);
  }

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(userType, userId, questionBank.course_id);
  if (!hasAccess) {
    throw new ErrorClass("Access denied", 403);
  }

  // Store original values for audit log
  const originalCreatorId = questionBank.created_by;
  const originalValues = {
    question_text: questionBank.theory.question_text,
    max_marks: questionBank.theory.max_marks,
  };

  const {
    question_text,
    max_marks,
    difficulty,
    topic,
    tags,
    rubric_json,
    image_url,
    video_url,
  } = req.body;

  // Update question bank
  const bankUpdates = {};
  if (difficulty !== undefined) bankUpdates.difficulty = difficulty;
  if (topic !== undefined) bankUpdates.topic = topic;
  if (tags !== undefined) bankUpdates.tags = tags;

  if (Object.keys(bankUpdates).length > 0) {
    await questionBank.update(bankUpdates);
  }

  // Update theory question
  const theoryUpdates = {};
  if (question_text !== undefined) theoryUpdates.question_text = question_text;
  if (max_marks !== undefined) theoryUpdates.max_marks = max_marks;
  if (rubric_json !== undefined) theoryUpdates.rubric_json = rubric_json;
  if (image_url !== undefined) theoryUpdates.image_url = image_url;
  if (video_url !== undefined) theoryUpdates.video_url = video_url;

  if (Object.keys(theoryUpdates).length > 0) {
    await questionBank.theory.update(theoryUpdates);
  }

  // Fetch updated question
  const updatedQuestion = await QuestionBank.findByPk(questionId, {
    include: [{ model: QuestionTheory, as: "theory" }],
  });

  // Log admin activity if admin modified staff-created question
  if (userType === "admin" && originalCreatorId !== userId) {
    try {
      await logAdminActivity(
        userId,
        "updated_question",
        "question",
        questionId,
        {
          course_id: questionBank.course_id,
          question_type: "theory",
          original_creator_id: originalCreatorId,
          changes: {
            before: originalValues,
            after: {
              question_text: theoryUpdates.question_text || originalValues.question_text,
              max_marks: theoryUpdates.max_marks || originalValues.max_marks,
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
    message: "Theory question updated successfully",
    data: updatedQuestion,
  });
});

/**
 * DELETE QUESTION
 * DELETE /api/exams/bank/questions/:questionId
 */
export const deleteQuestion = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const questionId = Number(req.params.questionId);

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can delete questions", 403);
  }

  const questionBank = await QuestionBank.findByPk(questionId);

  if (!questionBank) {
    throw new ErrorClass("Question not found", 404);
  }

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(userType, userId, questionBank.course_id);
  if (!hasAccess) {
    throw new ErrorClass("Access denied", 403);
  }

  // Store question info for audit log before deletion
  const questionInfo = {
    id: questionBank.id,
    course_id: questionBank.course_id,
    question_type: questionBank.question_type,
    original_creator_id: questionBank.created_by,
  };

  // Delete question (cascade will handle objective/theory)
  await questionBank.destroy();

  // Log admin activity if admin deleted staff-created question
  if (userType === "admin" && questionInfo.original_creator_id !== userId) {
    try {
      await logAdminActivity(
        userId,
        "deleted_question",
        "question",
        questionId,
        {
          course_id: questionInfo.course_id,
          question_type: questionInfo.question_type,
          original_creator_id: questionInfo.original_creator_id,
        }
      );
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Question deleted successfully",
  });
});

/**
 * GET QUESTION BY ID
 * GET /api/exams/bank/questions/:questionId
 */
export const getQuestionById = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  const userType = req.user?.userType;
  const questionId = Number(req.params.questionId);

  if (userType !== "staff" && userType !== "admin") {
    throw new ErrorClass("Only staff and admins can access questions", 403);
  }

  const question = await QuestionBank.findByPk(questionId, {
    include: [
      { model: QuestionObjective, as: "objective" },
      { model: QuestionTheory, as: "theory" },
    ],
  });

  if (!question) {
    throw new ErrorClass("Question not found", 404);
  }

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(userType, userId, question.course_id);
  if (!hasAccess) {
    throw new ErrorClass("Access denied", 403);
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Question retrieved successfully",
    data: question,
  });
});
