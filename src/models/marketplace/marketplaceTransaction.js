import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const MarketplaceTransaction = db.define(
  "MarketplaceTransaction",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to courses table",
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to students table - who purchased",
    },
    owner_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
      comment: "Type of course owner",
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of course owner (sole_tutor.id or organization.id)",
    },
    course_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Price student paid for course",
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "NGN",
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      comment: "WPU commission percentage at time of purchase",
    },
    wsp_commission: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Amount WPU receives as commission",
    },
    tutor_earnings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Amount tutor/organization receives (after commission)",
    },
    payment_status: {
      type: DataTypes.ENUM("pending", "completed", "failed", "refunded"),
      allowNull: false,
      defaultValue: "pending",
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Payment gateway used (stripe, paystack, etc.)",
    },
    payment_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Payment gateway transaction reference",
    },
    wsp_paid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether WPU has received the commission",
    },
    tutor_paid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether tutor has been paid out",
    },
    payout_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date tutor was paid out",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: "marketplace_transactions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["course_id"],
      },
      {
        fields: ["student_id"],
      },
      {
        fields: ["owner_type", "owner_id"],
      },
      {
        fields: ["payment_status"],
      },
      {
        fields: ["created_at"],
      },
    ],
  }
);

