import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Membership = db.define(
  "Membership",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of tutor (sole_tutor or organization)",
    },
    tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Membership name (tutor can name it anything)",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Membership description",
    },
    category: {
      type: DataTypes.ENUM(
        "Business & Management",
        "Technology & Data",
        "Engineering & Physical Science",
        "Health & Medicine",
        "Arts & Humanities",
        "Personal Development & Education",
        "Religious and Faith",
        "Social and Impact"
      ),
      allowNull: true,
      comment: "Membership category",
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Membership cover image URL",
    },
    pricing_type: {
      type: DataTypes.ENUM("free", "monthly", "yearly", "lifetime"),
      allowNull: false,
      defaultValue: "monthly",
      comment: "Pricing model: free, monthly subscription, yearly subscription, or lifetime",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Price (0 for free, monthly/yearly amount for subscription, one-time for lifetime)",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency for pricing",
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
      comment: "Membership status (inactive when tutor subscription expires)",
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Commission rate (0 for memberships - no commission)",
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      comment: "URL-friendly slug for public product link",
    },
    is_featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether product is featured",
    },
    featured_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When product was featured",
    },
    popularity_score: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Calculated popularity score (sales + reviews + views)",
    },
    sales_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of subscriptions",
    },
  },
  {
    tableName: "memberships",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tutor_id", "tutor_type"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["pricing_type"],
      },
      {
        fields: ["slug"],
      },
    ],
  }
);
