import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const EmailPreference = db.define(
  "EmailPreference",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the user (student or staff)",
    },
    user_type: {
      type: DataTypes.ENUM("student", "staff"),
      allowNull: false,
      defaultValue: "student",
      comment: "Type of user",
    },
    receive_course_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Receive course enrollment and update notifications",
    },
    receive_grade_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Receive notifications when grades are posted",
    },
    receive_exam_reminders: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Receive exam reminder notifications",
    },
    receive_quiz_reminders: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Receive quiz deadline reminders",
    },
    receive_announcements: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Receive general announcements and updates",
    },
    receive_discussion_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Receive notifications for discussion replies",
    },
  },
  {
    tableName: "email_preferences",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["user_id", "user_type"],
        name: "unique_user_preference",
      },
    ],
  }
);

