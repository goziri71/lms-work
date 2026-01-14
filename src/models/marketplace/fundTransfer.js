/**
 * Fund Transfer Model
 * Tracks fund transfers from tutor wallets to next of kin (initiated by super admin)
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const FundTransfer = db.define(
  "FundTransfer",
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
    next_of_kin_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to tutor_next_of_kin table",
    },
    transfer_reason: {
      type: DataTypes.ENUM("death", "inactivity", "account_closure", "other"),
      allowNull: false,
      comment: "Reason for fund transfer",
    },
    reason_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Detailed description of transfer reason",
    },
    amount_primary: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Amount transferred in primary currency",
    },
    amount_usd: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Amount transferred in USD",
    },
    amount_gbp: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Amount transferred in GBP",
    },
    currency_primary: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: "Primary currency code",
    },
    total_amount_ngn_equivalent: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Total amount in NGN equivalent (for reporting)",
    },
    transfer_method: {
      type: DataTypes.ENUM("bank_transfer", "wallet", "check", "other"),
      allowNull: false,
      comment: "Method used for transfer",
    },
    transfer_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Reference number from bank/transfer service",
    },
    initiated_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Admin ID who initiated the transfer",
    },
    initiated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "Date when transfer was initiated",
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when transfer was completed",
    },
    status: {
      type: DataTypes.ENUM("pending", "processing", "completed", "failed", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
      comment: "Status of the fund transfer",
    },
    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason if transfer failed",
    },
    supporting_documents: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Array of document URLs supporting the transfer (e.g., death certificate)",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Additional notes or comments",
    },
  },
  {
    tableName: "fund_transfers",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tutor_id", "tutor_type"],
      },
      {
        fields: ["next_of_kin_id"],
      },
      {
        fields: ["initiated_by"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["initiated_at"],
      },
    ],
  }
);
