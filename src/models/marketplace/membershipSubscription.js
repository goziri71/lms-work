import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const MembershipSubscription = db.define(
  "MembershipSubscription",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Student/learner ID",
    },
    membership_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Membership ID",
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
      comment: "Subscription end date (null for lifetime, calculated for monthly/yearly)",
    },
    next_payment_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Next payment date (for monthly/yearly subscriptions)",
    },
    auto_renew: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Auto-renew subscription",
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When subscription was cancelled",
    },
  },
  {
    tableName: "membership_subscriptions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["student_id", "membership_id"],
        name: "unique_student_membership",
      },
      {
        fields: ["student_id"],
      },
      {
        fields: ["membership_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["next_payment_date"],
      },
    ],
  }
);
