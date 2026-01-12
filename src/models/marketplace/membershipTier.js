import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const MembershipTier = db.define(
  "MembershipTier",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    membership_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the membership this tier belongs to",
    },
    tier_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Custom tier name set by tutor (e.g., 'Basic', 'Pro', 'Enterprise')",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Tier description/benefits",
    },
    monthly_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Price for monthly subscription to this tier",
    },
    yearly_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Price for yearly subscription to this tier",
    },
    lifetime_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Price for lifetime subscription to this tier",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency for pricing",
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Order for displaying tiers (lower number = higher priority)",
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
      comment: "Tier status",
    },
  },
  {
    tableName: "membership_tiers",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["membership_id"],
      },
      {
        fields: ["membership_id", "tier_name"],
        unique: true,
        name: "unique_membership_tier_name",
      },
      {
        fields: ["status"],
      },
      {
        fields: ["display_order"],
      },
    ],
  }
);
