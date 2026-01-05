import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const TutorPayout = db.define(
  "TutorPayout",
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
    bank_account_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to tutor_bank_accounts.id",
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Payout amount in base currency",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: "Currency of payout (tutor's local currency)",
    },
    converted_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Converted amount in payout currency (if different from base)",
    },
    fx_rate: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: true,
      comment: "Exchange rate used for conversion",
    },
    transfer_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Flutterwave transfer fee",
    },
    net_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Net amount after fees",
    },
    flutterwave_transfer_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Flutterwave transfer ID",
    },
    flutterwave_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
      comment: "Flutterwave transfer reference",
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "processing",
        "successful",
        "failed",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "pending",
      comment: "Payout status",
    },
    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason for failure if status is 'failed'",
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when payout was processed",
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when payout was completed",
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Additional metadata (FX info, transfer response, etc.)",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tutor_payouts",
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
        fields: ["flutterwave_reference"],
      },
      {
        fields: ["created_at"],
      },
    ],
  }
);

