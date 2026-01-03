import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CoachingHoursBalance = db.define(
  "CoachingHoursBalance",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
    },
    hours_balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Available coaching hours",
    },
    total_purchased: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      comment: "Total hours ever purchased",
    },
    total_used: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      comment: "Total hours ever used",
    },
    last_updated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "coaching_hours_balance",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["tutor_id", "tutor_type"],
        name: "unique_tutor_balance",
      },
    ],
  }
);

