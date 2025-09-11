import { dbLibrary } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Quiz = dbLibrary.define(
  "quiz",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    module_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    attempts_allowed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    show_results: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    shuffle_questions: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      allowNull: false,
      defaultValue: "draft",
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true, // null means no time limit
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
  },
  {
    tableName: "quiz",
    timestamps: false,
    freezeTableName: true,
  }
);
