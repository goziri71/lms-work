import { dbLibrary } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Units = dbLibrary.define(
  "Units",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    module_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    content_type: {
      type: DataTypes.ENUM("html", "md", "url"),
      allowNull: false,
      defaultValue: "html",
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    duration_min: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "units",
    timestamps: false,
    freezeTableName: true,
  }
);
