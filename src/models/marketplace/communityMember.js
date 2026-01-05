import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CommunityMember = db.define(
  "CommunityMember",
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
    role: {
      type: DataTypes.ENUM("member", "moderator", "admin"),
      allowNull: false,
      defaultValue: "member",
      comment: "Member role in community",
    },
    status: {
      type: DataTypes.ENUM("active", "blocked", "left"),
      allowNull: false,
      defaultValue: "active",
      comment: "Member status",
    },
    subscription_status: {
      type: DataTypes.ENUM("active", "expired", "cancelled"),
      allowNull: false,
      defaultValue: "active",
      comment: "Subscription status",
    },
    subscription_start_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When subscription started",
    },
    subscription_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When subscription expires",
    },
    next_billing_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Next billing date for subscription",
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "When member joined",
    },
    last_active_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Last active timestamp",
    },
    access_blocked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When access was blocked (due to expired subscription)",
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
    tableName: "community_members",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["community_id", "student_id"],
        name: "unique_community_member",
      },
      {
        fields: ["community_id"],
      },
      {
        fields: ["student_id"],
      },
      {
        fields: ["subscription_status"],
      },
      {
        fields: ["status"],
      },
    ],
  }
);

