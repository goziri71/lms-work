import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Program = db.define(
  "Program",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    faculty_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Foreign key to faculty table",
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    token: {
      type: DataTypes.STRING(600),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Y",
      comment: "Y = Active, N = Inactive",
    },
  },
  {
    tableName: "programs",
    timestamps: false,
    freezeTableName: true,
    indexes: [
      {
        fields: ["faculty_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["title"],
      },
    ],
  }
);

