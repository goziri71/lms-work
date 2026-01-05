import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CoachingSession = db.define(
  "CoachingSession",
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
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Scheduled duration in minutes",
    },
    stream_call_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      comment: "Stream.io call ID",
    },
    view_link: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Public view link for students",
    },
    status: {
      type: DataTypes.ENUM("scheduled", "active", "ended", "cancelled"),
      allowNull: false,
      defaultValue: "scheduled",
    },
    hours_reserved: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      comment: "Hours deducted at session start",
    },
    hours_used: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      comment: "Actual hours used (calculated at end)",
    },
    student_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Number of students invited",
    },
    actual_start_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When session actually started",
    },
    actual_end_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When session actually ended",
    },
    warning_sent_10min: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    warning_sent_5min: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    warning_sent_low_balance: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    pricing_type: {
      type: DataTypes.ENUM("free", "paid"),
      allowNull: false,
      defaultValue: "free",
      comment: "Pricing type: free or paid",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Price for paid sessions",
    },
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: "NGN",
      comment: "Currency for paid sessions",
    },
    category: {
      type: DataTypes.ENUM(
        "Business",
        "Tech",
        "Art",
        "Logistics",
        "Ebooks",
        "Podcast",
        "Videos",
        "Music",
        "Articles",
        "Code",
        "2D/3D Files"
      ),
      allowNull: true,
      comment: "Session category",
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Session cover image URL",
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Session tags",
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 15.0,
      comment:
        "WPU commission rate for this session (separate from course commission)",
    },
    session_type: {
      type: DataTypes.ENUM("group", "one_on_one"),
      allowNull: false,
      defaultValue: "group",
      comment: "Session type: group or one-on-one",
    },
    scheduling_status: {
      type: DataTypes.ENUM(
        "awaiting_purchase",
        "awaiting_scheduling",
        "scheduled",
        "completed",
        "cancelled"
      ),
      allowNull: true,
      comment: "Scheduling status for one-on-one sessions",
    },
    agreed_start_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Agreed start time for one-on-one sessions",
    },
    agreed_end_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Agreed end time for one-on-one sessions",
    },
    scheduling_deadline: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Deadline for scheduling agreement (optional)",
    },
  },
  {
    tableName: "coaching_sessions",
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
      {
        fields: ["start_time"],
      },
    ],
  }
);
