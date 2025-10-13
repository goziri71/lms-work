import { DataTypes } from "sequelize";
import { dbLibrary } from "../../database/database.js";

export const QuestionObjective = dbLibrary.define(
  "question_objective",
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
    options: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: "Array of {id, text}; e.g. [{id:'A', text:'...'}]",
    },
    correct_option: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: "e.g. 'A', 'B', 'C', 'D'",
    },
    marks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 1.0,
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
    tableName: "question_objective",
    timestamps: false,
  }
);
