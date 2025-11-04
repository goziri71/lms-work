import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const EmailLog = db.define(
  "EmailLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "ID of the user (student or staff) who received the email",
    },
    user_type: {
      type: DataTypes.ENUM("student", "staff", "other"),
      allowNull: false,
      defaultValue: "student",
      comment: "Type of user who received the email",
    },
    recipient_email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    recipient_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email_type: {
      type: DataTypes.ENUM(
        "welcome",
        "password_reset",
        "email_verification",
        "course_enrollment",
        "exam_reminder",
        "exam_published",
        "grade_notification",
        "quiz_deadline",
        "announcement",
        "other"
      ),
      allowNull: false,
      comment: "Type/category of email sent",
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "sent", "failed", "bounced"),
      allowNull: false,
      defaultValue: "pending",
    },
    zepto_message_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Message ID returned by ZeptoMail API",
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Error message if email failed to send",
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Additional metadata (course_id, exam_id, etc.)",
    },
  },
  {
    tableName: "email_logs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["user_id", "user_type"],
      },
      {
        fields: ["recipient_email"],
      },
      {
        fields: ["email_type"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["created_at"],
      },
    ],
  }
);

