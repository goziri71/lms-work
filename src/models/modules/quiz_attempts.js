import { dbLibrary } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const QuizAttempts = dbLibrary.define(
  "quiz_attempts",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    quiz_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("in_progress", "submitted", "graded"),
      allowNull: false,
      defaultValue: "in_progress",
    },
    total_score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    max_possible_score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    graded_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    graded_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "quiz_attempts",
    timestamps: false,
    freezeTableName: true,
    indexes: [
      { fields: ["quiz_id", "student_id"] },
      { fields: ["student_id"] },
    ],
  }
);
