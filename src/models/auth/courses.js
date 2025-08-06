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
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    course_unit: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    course_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    course_level: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    course_code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    exam_fee: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    staff_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "courses", // Specify exact table name
    timestamps: false, // Disable createdAt/updatedAt
    freezeTableName: true, // Prevent pluralization
  }
);
