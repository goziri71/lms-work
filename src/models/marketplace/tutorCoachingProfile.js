import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const TutorCoachingProfile = db.define(
  "TutorCoachingProfile",
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
    hourly_rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Coaching-specific bio or description",
    },
    specializations: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Array of coaching specializations/topics",
    },
    is_accepting_bookings: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    min_duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
    },
    max_duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 180,
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "Africa/Lagos",
    },
    total_sessions_completed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    average_rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },
  },
  {
    tableName: "tutor_coaching_profiles",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["tutor_id", "tutor_type"],
        name: "unique_tutor_coaching_profile",
      },
      {
        fields: ["is_accepting_bookings"],
      },
    ],
  }
);
