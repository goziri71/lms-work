/**
 * Sales Page View Model
 * Tracks views/analytics for sales pages
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const SalesPageView = db.define(
  "SalesPageView",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sales_page_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Product Sales Page ID",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "User ID if logged in (null for anonymous)",
    },
    user_type: {
      type: DataTypes.ENUM("student", "sole_tutor", "organization", "staff", "admin"),
      allowNull: true,
      comment: "Type of user (null for anonymous)",
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: "IP address of viewer",
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "User agent string",
    },
    referrer: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "HTTP referrer URL",
    },
    converted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether this view resulted in a conversion (purchase)",
    },
    converted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When conversion happened (if converted)",
    },
  },
  {
    tableName: "sales_page_views",
    timestamps: true,
    createdAt: "viewed_at",
    updatedAt: false,
    indexes: [
      {
        fields: ["sales_page_id"],
      },
      {
        fields: ["user_id"],
      },
      {
        fields: ["viewed_at"],
      },
      {
        fields: ["converted"],
      },
    ],
  }
);
