/**
 * Google Drive Connection Model
 * Stores OAuth tokens and connection info for tutors' Google Drive accounts
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const GoogleDriveConnection = db.define(
  "GoogleDriveConnection",
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
    google_account_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Email of the connected Google account",
    },
    access_token: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "OAuth access token (encrypted)",
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "OAuth refresh token (encrypted)",
    },
    token_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the access token expires",
    },
    scope: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "OAuth scopes granted",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether connection is active",
    },
    last_sync_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Last time files were synced from Google Drive",
    },
    connected_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "When connection was established",
    },
  },
  {
    tableName: "google_drive_connections",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["tutor_id", "tutor_type"],
        name: "unique_tutor_google_drive",
      },
      {
        fields: ["is_active"],
      },
      {
        fields: ["last_sync_at"],
      },
    ],
  }
);
