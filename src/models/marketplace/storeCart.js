/**
 * Store Cart Model
 * Represents a shopping cart (can be guest or user cart)
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const StoreCart = db.define(
  "StoreCart",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Student ID if cart belongs to logged-in user (null for guest carts)",
    },
    session_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      comment: "Session ID for guest carts (null for user carts)",
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Expiration date for guest carts (2 days from creation, null for user carts)",
    },
    status: {
      type: DataTypes.ENUM("active", "abandoned", "converted", "expired"),
      allowNull: false,
      defaultValue: "active",
      comment: "Cart status",
    },
  },
  {
    tableName: "store_carts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["user_id"],
      },
      {
        fields: ["session_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["expires_at"],
      },
    ],
  }
);
