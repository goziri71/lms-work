import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

/**
 * Super-admin–issued single-use codes that grant tutors Grand Master–equivalent access for a fixed period.
 */
export const TutorAccessCode = db.define(
  "TutorAccessCode",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      comment: "SHA-256 hex of normalized code (no dashes/spaces, uppercase)",
    },
    code_hint: {
      type: DataTypes.STRING(8),
      allowNull: true,
      comment: "Last 4 characters (safe to show in admin lists)",
    },
    status: {
      type: DataTypes.ENUM("active", "revoked", "redeemed"),
      allowNull: false,
      defaultValue: "active",
    },
    valid_until: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "If set, code must be redeemed before this instant",
    },
    duration_months: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      validate: { min: 1, max: 24 },
    },
    redeemed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    redeemed_tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    redeemed_tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: true,
    },
    created_by_admin_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "tutor_access_codes",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["status"] },
      { fields: ["created_at"] },
      { fields: ["valid_until"] },
    ],
  },
);
