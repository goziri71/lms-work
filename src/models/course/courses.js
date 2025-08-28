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
    date: {
      type: DataTypes.DATE, // timestamp without time zone
      allowNull: false,
    },
  },
  {
    tableName: "courses", // Specify exact table name
    timestamps: false, // Disable createdAt/updatedAt
    freezeTableName: true, // Prevent pluralization
  }
);
