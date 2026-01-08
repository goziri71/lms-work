import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const MembershipProduct = db.define(
  "MembershipProduct",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    membership_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Membership ID",
    },
    product_type: {
      type: DataTypes.ENUM("course", "ebook", "digital_download", "coaching_session", "community"),
      allowNull: false,
      comment: "Type of product",
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the product (course_id, ebook_id, etc.)",
    },
  },
  {
    tableName: "membership_products",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["membership_id", "product_type", "product_id"],
        name: "unique_membership_product",
      },
      {
        fields: ["membership_id"],
      },
      {
        fields: ["product_type", "product_id"],
      },
    ],
  }
);
