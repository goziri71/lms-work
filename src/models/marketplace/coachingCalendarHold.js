import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CoachingCalendarHold = db.define(
  "CoachingCalendarHold",
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
    booking_request_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "released"),
      allowNull: false,
      defaultValue: "active",
    },
    availability_slot_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Specific-date slot deactivated when booking came from availability",
    },
  },
  {
    tableName: "coaching_calendar_holds",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["tutor_id", "tutor_type"] },
      { fields: ["status"] },
      { fields: ["start_time"] },
      { fields: ["booking_request_id"], unique: true },
    ],
  }
);
