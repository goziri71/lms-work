import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const TutorAvailability = db.define(
  "TutorAvailability",
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
    is_recurring: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "true = weekly recurring, false = specific date slot",
    },
    day_of_week: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0, max: 6 },
      comment: "0=Sunday, 1=Monday ... 6=Saturday (for recurring slots)",
    },
    specific_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Specific date (for non-recurring slots)",
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: "Start of availability window (HH:MM:SS)",
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: "End of availability window (HH:MM:SS)",
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Africa/Lagos",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "tutor_availability",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tutor_id", "tutor_type"],
      },
      {
        fields: ["is_recurring", "day_of_week"],
      },
      {
        fields: ["specific_date"],
      },
      {
        fields: ["is_active"],
      },
    ],
  }
);
