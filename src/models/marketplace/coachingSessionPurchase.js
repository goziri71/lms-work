import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CoachingSessionPurchase = db.define(
  "CoachingSessionPurchase",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    session_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "coaching_sessions",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "students",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    price_paid: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Price paid by student",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: "WPU commission rate applied",
    },
    wsp_commission: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "WPU commission amount",
    },
    tutor_earnings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Tutor earnings after commission",
    },
    transaction_ref: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      comment: "Transaction reference",
    },
    payment_method: {
      type: DataTypes.STRING(50),
      defaultValue: "wallet",
      comment: "Payment method used",
    },
    purchased_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "coaching_session_purchases",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["session_id", "student_id"],
        name: "unique_session_purchase",
      },
      {
        fields: ["session_id"],
      },
      {
        fields: ["student_id"],
      },
    ],
  }
);

// Associations are defined in src/models/associations.js

