import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const MembershipTierChange = db.define(
  "MembershipTierChange",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    subscription_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the membership subscription",
    },
    old_tier_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Previous tier ID (null for new subscriptions)",
    },
    old_tier_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Previous tier name",
    },
    new_tier_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "New tier ID",
    },
    new_tier_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "New tier name",
    },
    change_type: {
      type: DataTypes.ENUM("upgrade", "downgrade", "initial"),
      allowNull: false,
      comment: "Type of tier change",
    },
    payment_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Payment amount for upgrade (null for downgrade or initial)",
    },
    refund_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Prorated refund amount for downgrade (null for upgrade or initial)",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency for payment/refund",
    },
    effective_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "When the tier change takes effect",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Additional notes about the tier change",
    },
  },
  {
    tableName: "membership_tier_changes",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["subscription_id"],
      },
      {
        fields: ["old_tier_id"],
      },
      {
        fields: ["new_tier_id"],
      },
      {
        fields: ["change_type"],
      },
      {
        fields: ["effective_date"],
      },
    ],
  }
);
