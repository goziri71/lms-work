import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const LearnerActivityLog = db.define(
  "LearnerActivityLog",
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
    activity_type: {
      type: DataTypes.ENUM(
        "login",
        "logout",
        "course_view",
        "module_view",
        "unit_view",
        "course_completed",
        "module_completed",
        "unit_completed",
        "quiz_attempt",
        "exam_attempt",
        "download",
        "video_play",
        "other"
      ),
      allowNull: false,
      comment: "Type of activity",
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Course ID (if activity is course-related)",
    },
    module_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Module ID (if activity is module-related)",
    },
    unit_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Unit ID (if activity is unit-related)",
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
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: "IP address of the learner",
    },
    location_country: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Country from IP geolocation",
    },
    location_city: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "City from IP geolocation",
    },
    device_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Device type (mobile, desktop, tablet)",
    },
    browser: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Browser name and version",
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Full user agent string",
    },
    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Duration spent on this activity (for views)",
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Additional metadata (quiz score, exam score, etc.)",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "learner_activity_logs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      {
        fields: ["student_id"],
        name: "idx_learner_activity_student",
      },
      {
        fields: ["tutor_id", "tutor_type"],
        name: "idx_learner_activity_tutor",
      },
      {
        fields: ["course_id"],
        name: "idx_learner_activity_course",
      },
      {
        fields: ["activity_type"],
        name: "idx_learner_activity_type",
      },
      {
        fields: ["created_at"],
        name: "idx_learner_activity_created",
      },
      {
        fields: ["student_id", "course_id"],
        name: "idx_learner_activity_student_course",
      },
    ],
  }
);

