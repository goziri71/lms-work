import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CommunityAudioSession = db.define(
  "CommunityAudioSession",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    community_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to communities.id",
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Tutor ID who created the session",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Session title",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Session description",
    },
    stream_call_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      comment: "Stream.io audio call ID",
    },
    view_link: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Public link for members to join",
    },
    scheduled_start_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Scheduled start time (optional)",
    },
    scheduled_end_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Scheduled end time (optional)",
    },
    status: {
      type: DataTypes.ENUM("scheduled", "active", "ended", "cancelled"),
      allowNull: false,
      defaultValue: "scheduled",
      comment: "Session status",
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
    participant_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of participants",
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
    tableName: "community_audio_sessions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["community_id"],
      },
      {
        fields: ["created_by"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["scheduled_start_time"],
      },
    ],
  }
);

