import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const MembershipPayment = db.define(
  "MembershipPayment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    subscription_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Membership subscription ID",
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Student/learner ID",
    },
    membership_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Membership ID",
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Payment amount",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Payment currency",
    },
    payment_method: {
      type: DataTypes.ENUM("wallet", "flutterwave", "bank_transfer", "other"),
      allowNull: false,
      comment: "Payment method used",
    },
    payment_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Payment reference/transaction ID",
    },
    status: {
      type: DataTypes.ENUM("pending", "completed", "failed", "refunded"),
      allowNull: false,
      defaultValue: "pending",
      comment: "Payment status",
    },
    payment_period: {
      type: DataTypes.ENUM("monthly", "yearly", "lifetime"),
      allowNull: false,
      comment: "Payment period",
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When payment was completed",
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Additional payment metadata",
    },
  },
  {
    tableName: "membership_payments",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["subscription_id"],
      },
      {
        fields: ["student_id"],
      },
      {
        fields: ["membership_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["payment_reference"],
      },
    ],
  }
);
