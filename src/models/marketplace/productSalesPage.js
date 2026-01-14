/**
 * Product Sales Page Model
 * Stores custom sales pages for products (landing pages)
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const ProductSalesPage = db.define(
  "ProductSalesPage",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: "URL-friendly slug for the sales page",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Sales page title/headline",
    },
    hero_image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Hero/banner image URL",
    },
    hero_video_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Hero video URL (optional)",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Main content/description (HTML or markdown)",
    },
    features: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Array of features/benefits [{title, description, icon}]",
    },
    testimonials: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Array of testimonials [{name, text, rating, image}]",
    },
    faq: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Array of FAQs [{question, answer}]",
    },
    call_to_action_text: {
      type: DataTypes.STRING(200),
      allowNull: true,
      defaultValue: "Get Started Now",
      comment: "CTA button text",
    },
    call_to_action_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "CTA button URL (defaults to product purchase page)",
    },
    meta_title: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "SEO meta title",
    },
    meta_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "SEO meta description",
    },
    status: {
      type: DataTypes.ENUM("draft", "published"),
      allowNull: false,
      defaultValue: "draft",
      comment: "Sales page status",
    },
    views_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of times this sales page has been viewed",
    },
    conversions_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of conversions (purchases) from this sales page",
    },
  },
  {
    tableName: "product_sales_pages",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["product_type", "product_id"],
      },
      {
        fields: ["slug"],
      },
      {
        fields: ["status"],
      },
      {
        unique: true,
        fields: ["product_type", "product_id"],
        name: "unique_product_sales_page",
        comment: "One sales page per product",
      },
    ],
  }
);
