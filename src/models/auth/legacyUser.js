import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const LegacyUser = db.define(
  "LegacyUser",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fname: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    lname: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(44),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    password: {
      type: DataTypes.STRING(600),
      allowNull: false,
    },
    user_right: {
      type: DataTypes.STRING(20),
      allowNull: true, // 'Admin', 'IT', 'Registrar', etc.
    },
    file: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    token: {
      type: DataTypes.STRING(600),
      allowNull: true,
    },
    last_login: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    tableName: "users",
    freezeTableName: true,
    timestamps: false, // Using 'date' instead of timestamps
  }
);

