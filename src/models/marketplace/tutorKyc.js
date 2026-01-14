/**
 * Tutor KYC Model
 * Stores KYC information and documents for sole tutors
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const TutorKyc = db.define(
  "TutorKyc",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      comment: "FK to sole_tutors table (one KYC per tutor)",
    },
    bvn: {
      type: DataTypes.STRING(11),
      allowNull: true,
      comment: "Bank Verification Number (11 digits)",
    },
    bvn_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether BVN has been verified",
    },
    bvn_verification_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when BVN was verified",
    },
    bvn_verification_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Reference from BVN verification service",
    },
    bvn_verification_response: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Full response from BVN verification API",
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "First name from BVN verification",
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Last name from BVN verification",
    },
    date_of_birth: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date of birth from BVN verification",
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Phone number from BVN verification",
    },
    // Document uploads
    national_id_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "URL to uploaded national ID document",
    },
    national_id_type: {
      type: DataTypes.ENUM("national_id", "passport", "drivers_license", "voters_card", "other"),
      allowNull: true,
      comment: "Type of national ID document",
    },
    national_id_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "National ID number",
    },
    proof_of_address_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "URL to uploaded proof of address document",
    },
    passport_photo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "URL to uploaded passport photo",
    },
    additional_documents: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Array of additional document URLs [{type, url, name}]",
    },
    // Status and approval
    status: {
      type: DataTypes.ENUM("pending", "under_review", "approved", "rejected", "requires_resubmission"),
      allowNull: false,
      defaultValue: "pending",
      comment: "KYC status",
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when KYC was submitted",
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when KYC was reviewed",
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Admin ID who reviewed the KYC",
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason for rejection (if rejected)",
    },
    resubmission_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Notes for resubmission (if requires_resubmission)",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Additional notes from admin",
    },
  },
  {
    tableName: "tutor_kyc",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tutor_id"],
        unique: true,
      },
      {
        fields: ["status"],
      },
      {
        fields: ["bvn_verified"],
      },
      {
        fields: ["submitted_at"],
      },
      {
        fields: ["reviewed_at"],
      },
    ],
  }
);
