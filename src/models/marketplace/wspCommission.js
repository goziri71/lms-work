import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const WpuCommission = db.define(
  "WpuCommission",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to marketplace_transactions",
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Commission amount",
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "NGN",
    },
    status: {
      type: DataTypes.ENUM("pending", "collected", "refunded"),
      allowNull: false,
      defaultValue: "pending",
      comment: "pending = not yet collected, collected = in WPU account, refunded = returned to student",
    },
    collected_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "wsp_commissions", // Keep table name for backward compatibility
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      {
        fields: ["transaction_id"],
      },
      {
        fields: ["status"],
      },
    ],
  }
);

// Backward compatibility export
export const WspCommission = WpuCommission;

