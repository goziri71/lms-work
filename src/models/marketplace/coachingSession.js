import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CoachingSession = db.define(
  "CoachingSession",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of tutor (sole_tutor or organization)",
    },
    tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Scheduled duration in minutes",
    },
    stream_call_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      comment: "Stream.io call ID",
    },
    view_link: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Public view link for students",
    },
    status: {
      type: DataTypes.ENUM("scheduled", "active", "ended", "cancelled"),
      allowNull: false,
      defaultValue: "scheduled",
    },
    hours_reserved: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      comment: "Hours deducted at session start",
    },
    hours_used: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      comment: "Actual hours used (calculated at end)",
    },
    student_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Number of students invited",
    },
    actual_start_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When session actually started",
    },
    actual_end_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When session actually ended",
    },
    warning_sent_10min: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    warning_sent_5min: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    warning_sent_low_balance: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "coaching_sessions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tutor_id", "tutor_type"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["start_time"],
      },
    ],
  }
);

