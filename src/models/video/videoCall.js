import { DataTypes } from "sequelize";
import { dbLibrary } from "../../database/database.js";

export const VideoCall = dbLibrary.define(
  "video_calls",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "staff_id who created the call",
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Linked course (nullable for open calls)",
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    stream_call_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Stream Video call identifier",
    },
    call_type: {
      type: DataTypes.ENUM("lecture", "seminar"),
      allowNull: false,
      defaultValue: "lecture",
    },
    region: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Stream region preference (e.g., us-east, eu-west, auto)",
    },
    record: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    recording_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Stream recording URL (set by webhook)",
    },
    starts_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "video_calls",
    timestamps: false,
  }
);
