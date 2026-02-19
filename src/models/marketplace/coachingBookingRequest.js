import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CoachingBookingRequest = db.define(
  "CoachingBookingRequest",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "students",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
    },
    topic: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "What the student wants to learn about",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Additional details from the student",
    },
    category: {
      type: DataTypes.ENUM(
        "Business & Management",
        "Technology & Data",
        "Engineering & Physical Science",
        "Health & Medicine",
        "Arts & Humanities",
        "Personal Development & Education"
      ),
      allowNull: true,
    },
    proposed_start_time: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Student's proposed session start time",
    },
    proposed_end_time: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Student's proposed session end time",
    },
    proposed_duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_from_availability: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "true if student picked from tutor availability, false if custom proposed time",
    },
    counter_proposed_start_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Tutor's counter-proposed start time",
    },
    counter_proposed_end_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Tutor's counter-proposed end time",
    },
    counter_proposed_duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "counter_proposed",
        "accepted",
        "declined",
        "expired",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    accepted_by: {
      type: DataTypes.ENUM("tutor", "student"),
      allowNull: true,
      comment: "Who accepted the final time (tutor accepts student's time, or student accepts counter)",
    },
    hourly_rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Tutor's hourly rate at the time of request",
    },
    estimated_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Calculated price based on rate * duration",
    },
    final_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Final price charged on acceptance (may differ if duration changed via counter)",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
    },
    student_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tutor_note: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Tutor's response message (on accept, decline, or counter)",
    },
    session_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Reference to created CoachingSession after acceptance",
    },
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    declined_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Auto-expire pending requests after a certain time",
    },
  },
  {
    tableName: "coaching_booking_requests",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["student_id"],
      },
      {
        fields: ["tutor_id", "tutor_type"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["proposed_start_time"],
      },
      {
        fields: ["session_id"],
      },
    ],
  }
);
