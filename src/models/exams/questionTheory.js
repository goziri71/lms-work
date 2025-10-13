import { DataTypes } from "sequelize";
import { dbLibrary } from "../../database/database.js";

export const QuestionTheory = dbLibrary.define(
  "question_theory",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    question_bank_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to question_bank.id",
    },
    question_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    max_marks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
    rubric_json: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Optional grading guide/rubric",
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    video_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "question_theory",
    timestamps: false,
  }
);
