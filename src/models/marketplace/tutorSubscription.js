import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const TutorSubscription = db.define(
  "TutorSubscription",
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
      comment: "Type of tutor account",
    },
    subscription_tier: {
      type: DataTypes.ENUM("free", "basic", "professional", "expert", "grand_master"),
      allowNull: false,
      defaultValue: "free",
      comment: "Subscription tier level",
    },
    status: {
      type: DataTypes.ENUM("active", "expired", "cancelled", "pending"),
      allowNull: false,
      defaultValue: "active",
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Subscription end date (null for lifetime)",
    },
    auto_renew: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    courses_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Maximum courses allowed (null = unlimited)",
    },
    communities_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Maximum communities allowed (null = unlimited)",
    },
    digital_downloads_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Maximum digital downloads allowed (null = unlimited)",
    },
    memberships_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Maximum memberships allowed (null = unlimited)",
    },
    unlimited_coaching: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "If true, tutor has unlimited coaching hours",
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 10.0,
      comment: "WPU commission percentage for this tier",
    },
  },
  {
    tableName: "tutor_subscriptions",
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
    ],
  }
);

// Subscription tier definitions
export const SUBSCRIPTION_TIERS = {
  free: {
    name: "Free",
    price: 0,
    courses_limit: 2,
    communities_limit: 0,
    community_member_limit: 0,
    digital_downloads_limit: 0,
    memberships_limit: 0,
    unlimited_coaching: false,
    commission_rate: 10.0,
  },
  basic: {
    name: "Basic",
    price: 39,
    courses_limit: 5,
    communities_limit: 1,
    community_member_limit: 10,
    digital_downloads_limit: 0,
    memberships_limit: 1,
    unlimited_coaching: false,
    commission_rate: 10.0,
  },
  professional: {
    name: "Professional",
    price: 99,
    courses_limit: 25,
    communities_limit: 1,
    community_member_limit: 30,
    digital_downloads_limit: 10,
    memberships_limit: 3,
    unlimited_coaching: false,
    commission_rate: 10.0,
  },
  expert: {
    name: "Expert",
    price: 249,
    courses_limit: 100,
    communities_limit: 3,
    community_member_limit: 50,
    digital_downloads_limit: 20,
    memberships_limit: 5,
    unlimited_coaching: true,
    commission_rate: 10.0,
  },
  grand_master: {
    name: "Grand Master",
    price: 499,
    courses_limit: null, // unlimited
    communities_limit: null, // unlimited
    community_member_limit: 100,
    digital_downloads_limit: null, // unlimited
    memberships_limit: null, // unlimited
    unlimited_coaching: true,
    commission_rate: 10.0,
  },
};

