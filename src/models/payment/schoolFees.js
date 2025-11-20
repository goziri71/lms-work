import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const SchoolFees = db.define(
  "SchoolFees",
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
    amount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: true, // 'Paid', 'Pending', etc.
    },
    academic_year: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    semester: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    date: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    balance: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    teller_no: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    matric_number: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    total_amount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true, // 'Semester Registration', 'Course Registration', etc.
    },
    student_level: {
      type: DataTypes.STRING(11),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "NGN",
    },
  },
  {
    tableName: "school_fees",
    freezeTableName: true,
    timestamps: false,
  }
);

