/**
 * Store Cart Item Model
 * Represents items in a shopping cart
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const StoreCartItem = db.define(
  "StoreCartItem",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cart_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Store Cart ID",
    },
    product_type: {
      type: DataTypes.ENUM("course", "ebook", "digital_download", "community", "membership"),
      allowNull: false,
      comment: "Type of product",
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the product",
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Quantity (usually 1 for digital products, but can be multiple for memberships/subscriptions)",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Price at time of adding to cart (snapshot)",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency at time of adding to cart",
    },
  },
  {
    tableName: "store_cart_items",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["cart_id"],
      },
      {
        fields: ["product_type", "product_id"],
      },
      {
        unique: true,
        fields: ["cart_id", "product_type", "product_id"],
        name: "unique_cart_product",
        comment: "One item per product per cart",
      },
    ],
  }
);
