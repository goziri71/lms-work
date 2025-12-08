import { Courses } from "../models/course/courses.js";
import { Exam } from "../models/exams/index.js";
import { Quiz } from "../models/modules/quiz.js";
import { Modules } from "../models/modules/modules.js";

/**
 * Check if user can access a course
 * Admins can access all courses, staff can only access their own courses
 * @param {string} userType - User type (staff, admin, super_admin)
 * @param {number} userId - User ID
 * @param {number} courseId - Course ID
 * @returns {Promise<boolean>} - True if user can access the course
 */
export async function canAccessCourse(userType, userId, courseId) {
  // Admins can access all courses
  if (userType === "admin" || userType === "super_admin") {
    return true;
  }

  // Staff can only access their own courses
  if (userType === "staff") {
    const course = await Courses.findOne({
      where: { id: courseId, staff_id: userId },
    });
    return !!course;
  }

  return false;
}

/**
 * Check if user can modify an exam
 * Admins can modify all exams, staff can only modify their own exams
 * @param {string} userType - User type (staff, admin, super_admin)
 * @param {number} userId - User ID
 * @param {number} examId - Exam ID
 * @returns {Promise<{allowed: boolean, exam: object|null, originalCreatorId: number|null}>}
 */
export async function canModifyExam(userType, userId, examId) {
  const exam = await Exam.findByPk(examId);
  if (!exam) {
    return { allowed: false, exam: null, originalCreatorId: null };
  }

  // Admins can modify all exams
  if (userType === "admin" || userType === "super_admin") {
    return {
      allowed: true,
      exam,
      originalCreatorId: exam.created_by,
      isAdminModification: true,
    };
  }

  // Staff can only modify their own exams or exams for their courses
  if (userType === "staff") {
    const hasAccess = await canAccessCourse(userType, userId, exam.course_id);
    const isCreator = exam.created_by === userId;
    return {
      allowed: hasAccess || isCreator,
      exam,
      originalCreatorId: exam.created_by,
      isAdminModification: false,
    };
  }

  return { allowed: false, exam, originalCreatorId: exam.created_by };
}

/**
 * Check if user can modify a quiz
 * Admins can modify all quizzes, staff can only modify their own quizzes
 * @param {string} userType - User type (staff, admin, super_admin)
 * @param {number} userId - User ID
 * @param {number} quizId - Quiz ID
 * @returns {Promise<{allowed: boolean, quiz: object|null, originalCreatorId: number|null}>}
 */
export async function canModifyQuiz(userType, userId, quizId) {
  const quiz = await Quiz.findByPk(quizId);
  if (!quiz) {
    return { allowed: false, quiz: null, originalCreatorId: null };
  }

  // Get module to check course access
  const module = await Modules.findByPk(quiz.module_id);
  if (!module) {
    return { allowed: false, quiz, originalCreatorId: quiz.created_by };
  }

  // Admins can modify all quizzes
  if (userType === "admin" || userType === "super_admin") {
    return {
      allowed: true,
      quiz,
      originalCreatorId: quiz.created_by,
      isAdminModification: true,
      courseId: module.course_id,
    };
  }

  // Staff can only modify their own quizzes or quizzes for their courses
  if (userType === "staff") {
    const hasAccess = await canAccessCourse(userType, userId, module.course_id);
    const isCreator = quiz.created_by === userId;
    return {
      allowed: hasAccess || isCreator,
      quiz,
      originalCreatorId: quiz.created_by,
      isAdminModification: false,
      courseId: module.course_id,
    };
  }

  return {
    allowed: false,
    quiz,
    originalCreatorId: quiz.created_by,
    courseId: module.course_id,
  };
}

/**
 * Get the creator ID to use when creating exam/quiz
 * For admins, use admin ID. For staff, use staff ID.
 * @param {string} userType - User type
 * @param {number} userId - User ID
 * @returns {number} - Creator ID to use
 */
export function getCreatorId(userType, userId) {
  // Always use the actual user ID (admin or staff)
  return userId;
}

