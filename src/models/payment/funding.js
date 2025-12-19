import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Funding = db.define(
  "Funding",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    service_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Amount in student's currency (supports decimals for USD, etc.)",
    },
    date: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    ref: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    semester: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    academic_year: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING(15),
      allowNull: true, // 'Credit' or 'Debit'
    },
    balance: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
  },
  {
    tableName: "funding",
    freezeTableName: true,
    timestamps: false,
  }
);

