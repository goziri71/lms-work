import { dbLibrary } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const QuizAnswers = dbLibrary.define(
  "quiz_answers",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    attempt_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    question_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    answer_text: {
      type: DataTypes.TEXT,
      allowNull: true, // For short answer and essay
    },
    selected_option_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // For multiple choice
    },
    points_earned: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    is_correct: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    answered_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    graded_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true, // Staff feedback for essay questions
    },
  },
  {
    tableName: "quiz_answers",
    timestamps: false,
    freezeTableName: true,
    indexes: [
      { unique: true, fields: ["attempt_id", "question_id"] },
      { fields: ["attempt_id"] },
    ],
  }
);
