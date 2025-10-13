import { DataTypes } from "sequelize";
import { dbLibrary } from "../../database/database.js";

export const VideoCallParticipant = dbLibrary.define(
  "video_call_participants",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    call_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "FK to video_calls.id",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_type: {
      type: DataTypes.ENUM("staff", "student"),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("host", "cohost", "participant", "viewer"),
      allowNull: false,
      defaultValue: "participant",
    },
    joined_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    left_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "video_call_participants",
    timestamps: false,
  }
);
