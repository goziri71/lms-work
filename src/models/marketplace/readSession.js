/**
 * Read Session Model
 * Tracks reading progress for read-only digital downloads
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const ReadSession = db.define(
  "ReadSession",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    digital_download_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Digital Download ID",
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Student ID who is reading",
    },
    current_page: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Current page number being viewed",
    },
    total_pages: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Total pages in the document (if known)",
    },
    progress_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Reading progress percentage (0-100)",
    },
    last_read_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "Last time the document was accessed",
    },
    session_token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: "Unique session token for secure access",
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Session expiration time (for security)",
    },
  },
  {
    tableName: "read_sessions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["digital_download_id"],
      },
      {
        fields: ["student_id"],
      },
      {
        fields: ["session_token"],
      },
      {
        fields: ["expires_at"],
      },
      {
        unique: true,
        fields: ["digital_download_id", "student_id"],
        name: "unique_download_student_session",
        comment: "One active read session per student per download",
      },
    ],
  }
);
