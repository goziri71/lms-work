import { DataTypes } from "sequelize";
import { dbLibrary } from "../../database/database.js";

export const ExamAnswerTheory = dbLibrary.define(
  "exam_answers_theory",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    attempt_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to exam_attempts.id",
    },
    exam_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to exam_items.id",
    },
    answer_text: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Student's written answer",
    },
    file_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional file upload (e.g., scanned answer sheet)",
    },
    awarded_score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: "Manually graded score",
    },
    graded_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "staff_id who graded this answer",
    },
    graded_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional grading notes",
    },
    answered_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "exam_answers_theory",
    timestamps: false,
  }
);
