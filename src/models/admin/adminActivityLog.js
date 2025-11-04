import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const AdminActivityLog = db.define(
  "AdminActivityLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    admin_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Which admin performed this action",
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Action performed (e.g., edited_course, created_quiz)",
    },
    target_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "Type of target (course, student, staff, module, etc.)",
    },
    target_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "ID of the affected entity",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Human-readable description of the action",
    },
    changes: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Before/after values for edits",
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Additional context (course_id, staff_id, reason, etc.)",
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: "IP address of admin",
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Browser/device info",
    },
    result: {
      type: DataTypes.ENUM("success", "failed", "partial"),
      allowNull: false,
      defaultValue: "success",
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Error if action failed",
    },
  },
  {
    tableName: "admin_activity_logs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      {
        fields: ["admin_id"],
      },
      {
        fields: ["action"],
      },
      {
        fields: ["target_type", "target_id"],
      },
      {
        fields: ["created_at"],
      },
    ],
  }
);

