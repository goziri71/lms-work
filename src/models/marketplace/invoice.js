/**
 * Invoice Model
 * Stores invoices for all purchases and subscriptions
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Invoice = db.define(
  "Invoice",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    invoice_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "Unique invoice number (e.g., INV-2024-001234)",
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Student ID who made the purchase",
    },
    product_type: {
      type: DataTypes.ENUM(
        "course",
        "ebook",
        "digital_download",
        "community",
        "membership",
        "coaching_session",
        "coaching_hours"
      ),
      allowNull: false,
      comment: "Type of product purchased",
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the product purchased",
    },
    product_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Name/title of the product at time of purchase",
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Quantity purchased",
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Price per unit at time of purchase",
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Subtotal (quantity * unit_price)",
    },
    tax_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Tax amount (if applicable)",
    },
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Discount amount (if applicable)",
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Total amount (subtotal + tax - discount)",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency code",
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Payment method used (e.g., 'card', 'bank_transfer', 'wallet')",
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
    invoice_status: {
      type: DataTypes.ENUM("draft", "sent", "paid", "cancelled"),
      allowNull: false,
      defaultValue: "draft",
      comment: "Invoice status",
    },
    issued_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "Invoice issue date",
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Invoice due date (if applicable)",
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when invoice was paid",
    },
    pdf_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "URL of generated PDF invoice",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Additional notes or terms",
    },
    billing_address: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Billing address (JSON object)",
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Tutor ID (if product is from a tutor)",
    },
    tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: true,
      comment: "Type of tutor",
    },
  },
  {
    tableName: "invoices",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["invoice_number"],
      },
      {
        fields: ["student_id"],
      },
      {
        fields: ["product_type", "product_id"],
      },
      {
        fields: ["payment_status"],
      },
      {
        fields: ["invoice_status"],
      },
      {
        fields: ["issued_at"],
      },
      {
        fields: ["tutor_id", "tutor_type"],
      },
    ],
  }
);
