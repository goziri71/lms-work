import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const MembershipTierProduct = db.define(
  "MembershipTierProduct",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tier_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the membership tier",
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
    monthly_access_level: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Access level description for monthly subscribers (defined by tutor)",
    },
    yearly_access_level: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Access level description for yearly subscribers (defined by tutor)",
    },
    lifetime_access_level: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Access level description for lifetime subscribers (defined by tutor)",
    },
  },
  {
    tableName: "membership_tier_products",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["tier_id", "product_type", "product_id"],
        name: "unique_tier_product",
      },
      {
        fields: ["tier_id"],
      },
      {
        fields: ["product_type", "product_id"],
      },
    ],
  }
);
