import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const TutorWalletTransaction = db.define(
  "TutorWalletTransaction",
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
    transaction_type: {
      type: DataTypes.ENUM("credit", "debit"),
      allowNull: false,
      comment: "Credit (funding) or Debit (subscription, coaching hours, etc.)",
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Transaction amount",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency code",
    },
    service_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Service name (e.g., 'Wallet Funding', 'Subscription Payment', 'Coaching Hours')",
    },
    transaction_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Payment reference (Flutterwave tx_ref, etc.)",
    },
    flutterwave_transaction_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Flutterwave transaction ID",
    },
    balance_before: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Wallet balance before this transaction",
    },
    balance_after: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Wallet balance after this transaction",
    },
    related_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Related entity ID (subscription_id, coaching_hours_purchase_id, etc.)",
    },
    related_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Related entity type (subscription, coaching_hours, etc.)",
    },
    status: {
      type: DataTypes.ENUM("pending", "successful", "failed", "cancelled"),
      allowNull: false,
      defaultValue: "successful",
      comment: "Transaction status",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Additional notes",
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Additional metadata (Flutterwave response, etc.)",
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
    tableName: "tutor_wallet_transactions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tutor_id", "tutor_type"],
      },
      {
        fields: ["transaction_type"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["transaction_reference"],
      },
      {
        fields: ["created_at"],
      },
    ],
  }
);

