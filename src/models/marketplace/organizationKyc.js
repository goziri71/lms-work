/**
 * Organization KYC Model
 * Business verification (CAC, company docs) for organization accounts
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const OrganizationKyc = db.define(
  "OrganizationKyc",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    organization_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      comment: "FK to organizations (one KYC per organization)",
    },
    business_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Registered business / company name",
    },
    trading_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Trading / brand name if different",
    },
    business_type: {
      type: DataTypes.ENUM(
        "limited_company",
        "business_name",
        "ngo",
        "partnership",
        "sole_proprietorship",
        "other"
      ),
      allowNull: true,
    },
    cac_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "CAC RC / BN number",
    },
    tin: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Tax Identification Number",
    },
    date_of_incorporation: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    registered_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    operating_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    business_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    business_phone: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    nature_of_business: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    directors: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "[{ name, role, id_number? }]",
    },
    // Document uploads (private storage URLs / signed URLs)
    cac_certificate_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "CAC certificate of incorporation / registration",
    },
    cac_status_report_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "CAC status report",
    },
    memorandum_articles_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "MEMART / constitution document",
    },
    proof_of_address_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tax_document_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "TIN certificate or tax clearance",
    },
    authorized_rep_id_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "ID of authorized representative / signatory",
    },
    additional_documents: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "[{ type, url, name }]",
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "under_review",
        "approved",
        "rejected",
        "requires_resubmission"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Admin ID who reviewed",
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resubmission_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "organization_kyc",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { unique: true, fields: ["organization_id"] },
      { fields: ["status"] },
      { fields: ["cac_number"] },
      { fields: ["submitted_at"] },
    ],
  }
);
