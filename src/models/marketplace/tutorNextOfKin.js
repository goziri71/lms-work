/**
 * Tutor Next of Kin Model
 * Stores next of kin information for tutors (sole tutors and organizations)
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const TutorNextOfKin = db.define(
  "TutorNextOfKin",
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
    full_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Full name of next of kin",
    },
    relationship: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Relationship to tutor (e.g., 'Spouse', 'Child', 'Parent', 'Sibling')",
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Email address of next of kin",
    },
    phone_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "Phone number of next of kin",
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Physical address of next of kin",
    },
    identification_type: {
      type: DataTypes.ENUM("national_id", "passport", "drivers_license", "voters_card", "other"),
      allowNull: true,
      comment: "Type of identification document",
    },
    identification_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Identification document number",
    },
    identification_document_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "URL to uploaded identification document",
    },
    bank_account_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Bank account name for fund transfer",
    },
    bank_account_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Bank account number for fund transfer",
    },
    bank_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Bank name",
    },
    bank_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Bank code (e.g., Swift code, routing number)",
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether next of kin information has been verified",
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when next of kin was verified",
    },
    verified_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Admin ID who verified the next of kin",
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "pending_verification"),
      allowNull: false,
      defaultValue: "pending_verification",
      comment: "Status of next of kin record",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Additional notes or comments",
    },
  },
  {
    tableName: "tutor_next_of_kin",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tutor_id", "tutor_type"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["is_verified"],
      },
      {
        unique: true,
        fields: ["tutor_id", "tutor_type"],
        name: "unique_tutor_next_of_kin",
        comment: "One next of kin per tutor",
      },
    ],
  }
);
