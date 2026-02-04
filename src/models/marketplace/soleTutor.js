import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const SoleTutor = db.define(
  "SoleTutor",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    },
    fname: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    lname: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    mname: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Tutor biography/description",
    },
    profile_image: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    specialization: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "Subject areas of expertise",
    },
    qualifications: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Educational qualifications",
    },
    experience_years: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("pending", "active", "suspended", "rejected"),
      allowNull: false,
      defaultValue: "pending",
      comment:
        "pending = awaiting approval, active = approved, suspended = temporarily disabled, rejected = application rejected",
    },
    verification_status: {
      type: DataTypes.ENUM("unverified", "verified", "rejected"),
      allowNull: false,
      defaultValue: "unverified",
      comment: "Identity/document verification status",
    },
    wallet_balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment:
        "Available balance for payouts - legacy field (use wallet_balance_primary)",
    },
    wallet_balance_primary: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Primary wallet balance (local currency)",
    },
    wallet_balance_usd: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "USD wallet balance",
    },
    wallet_balance_gbp: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "GBP wallet balance",
    },
    total_earnings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Total earnings (before commission)",
    },
    total_payouts: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Total amount paid out",
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 15.0,
      comment: "WPU commission percentage (default 15%)",
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: 0.0,
      comment: "Average rating from students",
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
      comment: "Stored document URLs (ID, certificates, etc.)",
    },
    address: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    country_code: {
      type: DataTypes.STRING(2),
      allowNull: true,
      comment: "ISO 3166-1 alpha-2 country code (e.g., 'NG', 'GB', 'US')",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "NGN",
      comment: "Currency code (e.g., 'NGN', 'USD', 'GHS') - legacy field",
    },
    local_currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: "NGN",
      comment: "Tutor's local currency (primary wallet currency)",
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "UTC",
    },
    slug: {
      type: DataTypes.STRING(120),
      allowNull: true,
      unique: true,
      comment: "URL-friendly slug for public tutor page (e.g. jane-doe)",
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
    tableName: "sole_tutors",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
      {
        unique: true,
        fields: ["slug"],
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
