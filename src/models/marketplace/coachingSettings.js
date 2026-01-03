import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CoachingSettings = db.define(
  "CoachingSettings",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    price_per_hour: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 10.0,
      comment: "Price per coaching hour (set by WPU admin)",
    },
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: "NGN",
    },
    default_duration_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 60,
      comment: "Default session duration in minutes",
    },
    warning_threshold_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
      comment: "Minutes before end to send warning",
    },
    auto_end_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Whether to automatically end sessions when time is up",
    },
  },
  {
    tableName: "coaching_settings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

