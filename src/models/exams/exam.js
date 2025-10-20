import { DataTypes } from "sequelize";
import { dbLibrary } from "../../database/database.js";

export const Exam = dbLibrary.define(
  "exams",
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
    academic_year: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "e.g. '2024/2025'",
    },
    semester: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "e.g. '1ST', '2ND'",
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    start_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Exam availability start",
    },
    end_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Exam availability end",
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60,
    },
    visibility: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      allowNull: false,
      defaultValue: "draft",
    },
    randomize: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Randomize question order per student",
    },
    exam_type: {
      type: DataTypes.ENUM("mixed", "objective-only", "theory-only"),
      allowNull: false,
      defaultValue: "mixed",
    },
    objective_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Number of random objective questions to select per attempt",
    },
    theory_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Number of random theory questions to select per attempt",
    },
    selection_mode: {
      type: DataTypes.ENUM("random", "manual"),
      allowNull: false,
      defaultValue: "random",
      comment:
        "random = auto-select from bank, manual = pre-selected questions",
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "staff_id",
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
    tableName: "exams",
    timestamps: false,
  }
);
