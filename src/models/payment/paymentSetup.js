import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const PaymentSetup = db.define(
  "PaymentSetup",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    item: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(300),
      allowNull: true, // Allow empty strings as per SQL dump
      defaultValue: "",
    },
    semester: {
      type: DataTypes.STRING(15),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: false,
    },
  },
  {
    tableName: "payment_setup",
    freezeTableName: true,
    timestamps: false,
  }
);

