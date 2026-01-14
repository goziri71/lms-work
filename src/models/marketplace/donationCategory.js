/**
 * Donation Category Model
 * Categories for organizing donations (e.g., "Religious and Faith", "Social Impact", etc.)
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const DonationCategory = db.define(
  "DonationCategory",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: "Category name (e.g., 'Religious and Faith', 'Social Impact')",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Category description",
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Icon identifier or emoji for the category",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether category is active",
    },
  },
  {
    tableName: "donation_categories",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["name"],
      },
      {
        fields: ["is_active"],
      },
    ],
  }
);
