import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const EBooks = db.define(
  "EBooks",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    author: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    pages: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "NGN",
    },
    pdf_url: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "URL of the PDF file in Supabase storage",
    },
    cover_image: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "URL of the cover image",
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "E-book category (e.g., 'Technology', 'Business', 'Education')",
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: "Searchable tags for the e-book",
    },
    owner_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
      comment: "Type of owner (sole_tutor or organization)",
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of owner (sole_tutor.id or organization.id)",
    },
    status: {
      type: DataTypes.ENUM("draft", "published"),
      allowNull: false,
      defaultValue: "draft",
      comment: "Publication status",
    },
    sales_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of times this e-book has been purchased",
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
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "ebooks",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    freezeTableName: true,
    indexes: [
      {
        fields: ["owner_type", "owner_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["category"],
      },
      {
        fields: ["slug"],
      },
    ],
  }
);

