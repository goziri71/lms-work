import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const TutorMailbox = db.define(
  "TutorMailbox",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
    },
    provider: {
      type: DataTypes.ENUM("gmail", "outlook"),
      allowNull: false,
    },
    email_address: {
      type: DataTypes.STRING(320),
      allowNull: false,
    },
    access_token: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Encrypted OAuth access token",
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Encrypted OAuth refresh token",
    },
    token_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    scope: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** Gmail users.history.list cursor */
    provider_sync_cursor: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "Gmail historyId or Graph delta token",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_sync_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    connected_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tutor_mailboxes",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["tutor_id", "tutor_type", "provider"],
        name: "uniq_tutor_mailbox_provider",
      },
      { fields: ["email_address"] },
      { fields: ["is_active"] },
    ],
  }
);
