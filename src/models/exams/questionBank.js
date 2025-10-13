import { DataTypes } from "sequelize";
import { dbLibrary } from "../../database/database.js";

export const QuestionBank = dbLibrary.define(
  "question_bank",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to courses.id in LMS DB (soft reference)",
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "staff_id who created this question",
    },
    question_type: {
      type: DataTypes.ENUM("objective", "theory"),
      allowNull: false,
    },
    difficulty: {
      type: DataTypes.ENUM("easy", "medium", "hard"),
      allowNull: true,
    },
    topic: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: "Searchable keywords",
    },
    status: {
      type: DataTypes.ENUM("draft", "approved", "archived"),
      allowNull: false,
      defaultValue: "draft",
    },
    source_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "e.g. 'quiz', 'manual', 'import'",
    },
    source_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Original quiz_question_id if imported",
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "question_bank",
    timestamps: false,
  }
);
