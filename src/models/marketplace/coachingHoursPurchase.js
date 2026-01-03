import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CoachingHoursPurchase = db.define(
  "CoachingHoursPurchase",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
    },
    hours_purchased: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Number of hours purchased",
    },
    price_per_hour: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Price per hour at time of purchase",
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Total amount paid",
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
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: "NGN",
    },
    status: {
      type: DataTypes.ENUM("pending", "completed", "failed", "refunded"),
      defaultValue: "completed",
    },
    purchased_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "coaching_hours_purchases",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tutor_id", "tutor_type"],
      },
      {
        fields: ["transaction_ref"],
      },
      {
        fields: ["status"],
      },
    ],
  }
);

