import { DataTypes } from "sequelize";
import { dbLibrary } from "../../database/database.js";

export const ExamAnswerObjective = dbLibrary.define(
  "exam_answers_objective",
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
    selected_option: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: "e.g. 'A', 'B', 'C', 'D' or null if unanswered",
    },
    is_correct: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: "Auto-computed on answer or submit",
    },
    awarded_score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: "Auto-computed based on correctness",
    },
    answered_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "exam_answers_objective",
    timestamps: false,
  }
);
