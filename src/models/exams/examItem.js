import { DataTypes } from "sequelize";
import { dbLibrary } from "../../database/database.js";

export const ExamItem = dbLibrary.define(
  "exam_items",
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
    attempt_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment:
        "FK to exam_attempts.id (null for manual mode, set for random per-attempt)",
    },
    question_bank_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to question_bank.id",
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Display order in exam",
    },
    marks_override: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: "Override default marks for this exam instance",
    },
  },
  {
    tableName: "exam_items",
    timestamps: false,
  }
);
