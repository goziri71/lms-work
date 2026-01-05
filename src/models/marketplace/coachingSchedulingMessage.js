import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CoachingSchedulingMessage = db.define(
  "CoachingSchedulingMessage",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    session_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to coaching_sessions.id",
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of sender (tutor_id or student_id)",
    },
    sender_type: {
      type: DataTypes.ENUM("tutor", "learner"),
      allowNull: false,
      comment: "Type of sender",
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Text message content",
    },
    message_type: {
      type: DataTypes.ENUM("text", "time_proposal"),
      allowNull: false,
      defaultValue: "text",
      comment: "Type of message",
    },
    proposed_start_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Proposed start time (if message_type is time_proposal)",
    },
    proposed_end_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Proposed end time (if message_type is time_proposal)",
    },
    status: {
      type: DataTypes.ENUM("pending", "accepted", "rejected"),
      allowNull: false,
      defaultValue: "pending",
      comment: "Status of time proposal (only for time_proposal messages)",
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When message was read by recipient",
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
    tableName: "coaching_scheduling_messages",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["session_id"],
      },
      {
        fields: ["sender_id", "sender_type"],
      },
      {
        fields: ["created_at"],
      },
      {
        fields: ["status"],
      },
    ],
  }
);

