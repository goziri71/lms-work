// Exam models - all stored in Library DB
export { QuestionBank } from "./questionBank.js";
export { QuestionObjective } from "./questionObjective.js";
export { QuestionTheory } from "./questionTheory.js";
export { Exam } from "./exam.js";
export { ExamItem } from "./examItem.js";
export { ExamAttempt } from "./examAttempt.js";
export { ExamAnswerObjective } from "./examAnswerObjective.js";
export { ExamAnswerTheory } from "./examAnswerTheory.js";

// Import for associations
import { QuestionBank } from "./questionBank.js";
import { QuestionObjective } from "./questionObjective.js";
import { QuestionTheory } from "./questionTheory.js";
import { Exam } from "./exam.js";
import { ExamItem } from "./examItem.js";
import { ExamAttempt } from "./examAttempt.js";
import { ExamAnswerObjective } from "./examAnswerObjective.js";
import { ExamAnswerTheory } from "./examAnswerTheory.js";
import { Students } from "../auth/student.js";

// Associations
export function setupExamAssociations() {
  // QuestionBank has one Objective or Theory question
  QuestionBank.hasOne(QuestionObjective, {
    foreignKey: "question_bank_id",
    as: "objective",
  });
  QuestionBank.hasOne(QuestionTheory, {
    foreignKey: "question_bank_id",
    as: "theory",
  });
  QuestionObjective.belongsTo(QuestionBank, {
    foreignKey: "question_bank_id",
    as: "bank",
  });
  QuestionTheory.belongsTo(QuestionBank, {
    foreignKey: "question_bank_id",
    as: "bank",
  });

  // Exam has many ExamItems
  Exam.hasMany(ExamItem, {
    foreignKey: "exam_id",
    as: "items",
  });
  ExamItem.belongsTo(Exam, {
    foreignKey: "exam_id",
    as: "exam",
  });

  // ExamItem references QuestionBank
  ExamItem.belongsTo(QuestionBank, {
    foreignKey: "question_bank_id",
    as: "question",
  });

  // Exam has many ExamAttempts
  Exam.hasMany(ExamAttempt, {
    foreignKey: "exam_id",
    as: "attempts",
  });
  ExamAttempt.belongsTo(Exam, {
    foreignKey: "exam_id",
    as: "exam",
  });

  // ExamAttempt has many answers
  ExamAttempt.hasMany(ExamAnswerObjective, {
    foreignKey: "attempt_id",
    as: "objectiveAnswers",
  });
  ExamAttempt.hasMany(ExamAnswerTheory, {
    foreignKey: "attempt_id",
    as: "theoryAnswers",
  });
  ExamAnswerObjective.belongsTo(ExamAttempt, {
    foreignKey: "attempt_id",
    as: "attempt",
  });
  ExamAnswerTheory.belongsTo(ExamAttempt, {
    foreignKey: "attempt_id",
    as: "attempt",
  });

  // Answers reference ExamItems
  ExamAnswerObjective.belongsTo(ExamItem, {
    foreignKey: "exam_item_id",
    as: "examItem",
  });
  ExamAnswerTheory.belongsTo(ExamItem, {
    foreignKey: "exam_item_id",
    as: "examItem",
  });

  // ExamAttempt belongsTo Student (cross-DB soft reference - no DB constraint)
  ExamAttempt.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
    constraints: false, // Cross-database reference - no foreign key constraint
  });
}
