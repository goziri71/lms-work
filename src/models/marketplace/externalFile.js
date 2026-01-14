/**
 * External File Model
 * Stores references to files stored in Google Drive or other external storage
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const ExternalFile = db.define(
  "ExternalFile",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Tutor ID (sole_tutor or organization)",
    },
    tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
      comment: "Type of tutor",
    },
    google_drive_connection_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "FK to google_drive_connections (if from Google Drive)",
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Original file name",
    },
    file_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "File MIME type",
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: "File size in bytes",
    },
    storage_type: {
      type: DataTypes.ENUM("google_drive", "dropbox", "onedrive", "other"),
      allowNull: false,
      defaultValue: "google_drive",
      comment: "Type of external storage",
    },
    external_file_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "File ID in external storage (e.g., Google Drive file ID)",
    },
    external_file_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Direct URL to file (if available)",
    },
    embed_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "URL for embedding file (e.g., Google Drive embed URL)",
    },
    thumbnail_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Thumbnail/preview image URL",
    },
    folder_path: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Path/folder in external storage",
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether file is publicly accessible",
    },
    access_level: {
      type: DataTypes.ENUM("public", "private", "restricted"),
      allowNull: false,
      defaultValue: "private",
      comment: "Access level for the file",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "File description",
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: "Tags for categorizing files",
    },
    imported_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "When file was imported",
    },
    last_accessed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Last time file was accessed",
    },
    status: {
      type: DataTypes.ENUM("active", "archived", "deleted"),
      allowNull: false,
      defaultValue: "active",
      comment: "File status",
    },
  },
  {
    tableName: "external_files",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tutor_id", "tutor_type"],
      },
      {
        fields: ["google_drive_connection_id"],
      },
      {
        fields: ["storage_type"],
      },
      {
        fields: ["external_file_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["imported_at"],
      },
    ],
  }
);
