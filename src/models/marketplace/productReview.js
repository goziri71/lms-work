/**
 * Product Review Model
 * Stores reviews/ratings for products (courses, ebooks, digital downloads, communities, memberships)
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const ProductReview = db.define(
  "ProductReview",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of student who wrote the review",
    },
    product_type: {
      type: DataTypes.ENUM("course", "ebook", "digital_download", "community", "membership"),
      allowNull: false,
      comment: "Type of product being reviewed",
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the product (course_id, ebook_id, etc.)",
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
      comment: "Rating from 1 to 5 stars",
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "Review title/headline",
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Review comment/description",
    },
    helpful_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of users who found this review helpful",
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "hidden"),
      allowNull: false,
      defaultValue: "pending",
      comment: "Review moderation status (pending = auto-approved for now, can add moderation later)",
    },
    is_verified_purchase: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether the reviewer actually purchased the product",
    },
  },
  {
    tableName: "product_reviews",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["product_type", "product_id"],
      },
      {
        fields: ["student_id"],
      },
      {
        fields: ["status"],
      },
      {
        unique: true,
        fields: ["student_id", "product_type", "product_id"],
        name: "unique_student_product_review",
        comment: "One review per student per product",
      },
      {
        fields: ["rating"],
      },
      {
        fields: ["helpful_count"],
      },
    ],
  }
);
