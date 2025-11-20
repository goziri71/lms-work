import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Faculty = db.define(
  "Faculty",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    token: {
      type: DataTypes.STRING(600),
      allowNull: false,
    },
  },
  {
    tableName: "faculty",
    freezeTableName: true,
    timestamps: false, // Using 'date' instead of timestamps
  }
);

