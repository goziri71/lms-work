import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const GeneralSetup = db.define(
  "GeneralSetup",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    rate: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
  },
  {
    tableName: "general_setup",
    freezeTableName: true,
    timestamps: false,
  }
);

