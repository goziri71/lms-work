import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Courses = db.define(
  "Courses",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    faculty_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    program_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    course_unit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    price: {
      type: DataTypes.STRING(12),
      allowNull: true,
    },
    course_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    course_level: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    semester: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    course_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    token: {
      type: DataTypes.STRING(600),
      allowNull: true,
    },
    exam_fee: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
    staff_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    owner_type: {
      type: DataTypes.ENUM("wpu", "wsp", "sole_tutor", "organization"),
      allowNull: false,
      defaultValue: "wpu",
      comment: "wpu = WPU owned (wsp is legacy), sole_tutor = owned by individual tutor, organization = owned by organization",
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "ID of owner (sole_tutor.id or organization.id, null for wsp)",
    },
    is_marketplace: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether course is listed in marketplace",
    },
    marketplace_status: {
      type: DataTypes.ENUM("draft", "pending", "approved", "rejected", "published"),
      allowNull: true,
      comment: "Marketplace listing status (only for marketplace courses)",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Course description/overview",
    },
    pricing_type: {
      type: DataTypes.ENUM("one_time", "free"),
      allowNull: false,
      defaultValue: "one_time",
      comment: "Pricing type: one_time or free",
    },
    course_outline: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Course benefits/outline",
    },
    duration_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Course duration in days",
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Course cover image URL",
    },
    category: {
      type: DataTypes.ENUM("Business", "Tech", "Art", "Logistics", "Ebooks", "Podcast", "Videos", "Music", "Articles", "Code", "2D/3D Files"),
      allowNull: true,
      comment: "Course category",
    },
    enrollment_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Maximum number of enrollments (marketplace only)",
    },
    access_duration_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Access duration in days from enrollment date (marketplace only)",
    },
    date: {
      type: DataTypes.DATE, // timestamp without time zone
      allowNull: false,
    },
  },
  {
    tableName: "courses", // Specify exact table name
    timestamps: false, // Disable createdAt/updatedAt
    freezeTableName: true, // Prevent pluralization
    paranoid: true, // Enable soft deletes using deleted_at
    deletedAt: "deleted_at", // Specify the column name for soft deletes
  }
);
