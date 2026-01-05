import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CommunitySubscription = db.define(
  "CommunitySubscription",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    community_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to communities.id",
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to students.id",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Monthly subscription price",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency for subscription",
    },
    status: {
      type: DataTypes.ENUM("active", "expired", "cancelled"),
      allowNull: false,
      defaultValue: "active",
      comment: "Subscription status",
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "Subscription start date",
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Subscription end date (null if active)",
    },
    next_billing_date: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Next billing date for renewal",
    },
    auto_renew: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Auto-renew subscription",
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When subscription was cancelled",
    },
    cancellation_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason for cancellation",
    },
    payment_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Payment reference for tracking",
    },
    email_sent_7days: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "7-day expiration email sent",
    },
    email_sent_3days: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "3-day expiration email sent",
    },
    email_sent_1day: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "1-day expiration email sent",
    },
    email_sent_expired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Expiration email sent",
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
    tableName: "community_subscriptions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["community_id", "student_id"],
        name: "unique_community_subscription",
        where: {
          status: "active",
        },
      },
      {
        fields: ["community_id"],
      },
      {
        fields: ["student_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["next_billing_date"],
      },
    ],
  }
);

