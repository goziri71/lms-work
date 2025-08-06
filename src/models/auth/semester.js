import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Semester = db.define(
  "Semester",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    academic_year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "semester", // Specify exact table name
    timestamps: false, // Disable createdAt/updatedAt
    freezeTableName: true, // Prevent pluralization
  }
);
