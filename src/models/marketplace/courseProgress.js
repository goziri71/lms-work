import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CourseProgress = db.define(
  "CourseProgress",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Student/learner ID",
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Course ID",
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Tutor ID (owner of the course)",
    },
    tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization", "wpu"),
      allowNull: true,
      comment: "Type of tutor (wpu for WPU-owned courses)",
    },
    total_modules: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total number of modules in the course",
    },
    completed_modules: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of completed modules",
    },
    total_units: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total number of units in the course",
    },
    viewed_units: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of units viewed",
    },
    completion_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Course completion percentage (0-100)",
    },
    is_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether all modules are completed",
    },
    last_accessed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Last time student accessed this course",
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When student first accessed this course",
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When student completed all modules",
    },
    total_time_spent_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total time spent on course in seconds",
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Additional progress metadata",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "course_progress",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["student_id", "course_id"],
        name: "idx_course_progress_unique",
      },
      {
        fields: ["tutor_id", "tutor_type"],
        name: "idx_course_progress_tutor",
      },
      {
        fields: ["course_id"],
        name: "idx_course_progress_course",
      },
      {
        fields: ["is_completed"],
        name: "idx_course_progress_completed",
      },
      {
        fields: ["last_accessed_at"],
        name: "idx_course_progress_last_accessed",
      },
    ],
  }
);

