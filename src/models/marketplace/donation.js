/**
 * Donation Model
 * Stores donation records (public and private)
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Donation = db.define(
  "Donation",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    donor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Student ID if donor is logged in (null for anonymous donations)",
    },
    donor_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Donor name (for anonymous or public donations)",
    },
    donor_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Donor email (optional, for receipts)",
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Donation amount",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency code",
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Donation category ID",
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional message from donor",
    },
    visibility: {
      type: DataTypes.ENUM("public", "private", "anonymous"),
      allowNull: false,
      defaultValue: "public",
      comment: "Donation visibility: public (show name), private (hide from wall), anonymous (show as anonymous)",
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Payment method used (e.g., 'card', 'bank_transfer')",
    },
    payment_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Payment reference/transaction ID",
    },
    payment_status: {
      type: DataTypes.ENUM("pending", "completed", "failed", "refunded"),
      allowNull: false,
      defaultValue: "pending",
      comment: "Payment status",
    },
    invoice_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Invoice ID if invoice was generated",
    },
    donated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "Date when donation was made",
    },
  },
  {
    tableName: "donations",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["donor_id"],
      },
      {
        fields: ["category_id"],
      },
      {
        fields: ["visibility"],
      },
      {
        fields: ["payment_status"],
      },
      {
        fields: ["donated_at"],
      },
      {
        fields: ["invoice_id"],
      },
    ],
  }
);
