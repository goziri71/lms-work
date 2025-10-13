import { DataTypes } from "sequelize";
import { dbLibrary } from "../../database/database.js";

export const ExamAttempt = dbLibrary.define(
  "exam_attempts",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    exam_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to exams.id",
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to students.id in LMS DB (soft reference)",
    },
    attempt_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Attempt number for this student+exam",
    },
    started_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("in_progress", "submitted", "graded", "abandoned"),
      allowNull: false,
      defaultValue: "in_progress",
    },
    total_score: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      comment: "Final computed score",
    },
    max_score: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      comment: "Max possible score for this attempt",
    },
    graded_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    graded_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "staff_id who finalized grading",
    },
  },
  {
    tableName: "exam_attempts",
    timestamps: false,
  }
);
