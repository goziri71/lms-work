import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CourseOrder = db.define(
  "CourseOrder",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    academic_year: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    semester: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    amount: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    level: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
  },
  {
    tableName: "course_order",
    freezeTableName: true,
    timestamps: false, // Using 'date' instead of timestamps
  }
);

