import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CommunityPurchase = db.define(
  "CommunityPurchase",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    community_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to communities.id",
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to students.id",
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
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 15.0,
      comment: "WPU commission rate",
    },
    wsp_commission: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "WPU commission amount",
    },
    tutor_earnings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Tutor earnings amount",
    },
    payment_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Payment reference",
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "wallet",
      comment: "Payment method used",
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
    tableName: "community_purchases",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["community_id"],
      },
      {
        fields: ["student_id"],
      },
      {
        fields: ["payment_reference"],
      },
      {
        fields: ["created_at"],
      },
    ],
  }
);

