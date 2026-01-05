import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Organization = db.define(
  "Organization",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Organization admin password",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    logo: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "NGN",
      comment: "Currency code (e.g., 'NGN', 'USD', 'GHS')",
    },
    registration_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Business registration number",
    },
    tax_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Tax identification number",
    },
    status: {
      type: DataTypes.ENUM("pending", "active", "suspended", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    verification_status: {
      type: DataTypes.ENUM("unverified", "verified", "rejected"),
      allowNull: false,
      defaultValue: "unverified",
    },
    wallet_balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    total_earnings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    total_payouts: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 15.0,
      comment: "WPU commission percentage",
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: 0.0,
    },
    total_reviews: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    password_reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    verification_documents: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Business registration, tax documents, etc.",
    },
    contact_person: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "Primary contact person name",
    },
    contact_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Primary contact email",
    },
    contact_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Primary contact phone",
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
    tableName: "organizations",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["verification_status"],
      },
    ],
  }
);

