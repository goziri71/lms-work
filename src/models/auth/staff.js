import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Staff = db.define(
  "Staff",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      // OPTIMIZATION: Add unique index for faster email lookups
      indexes: [
        {
          unique: true,
          fields: ["email"],
        },
      ],
    },
    phone: {
      type: DataTypes.STRING, // Changed from INTEGER to STRING
      allowNull: false,
    },
    linkedin: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    google_scholar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    file: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    research_areas: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    home_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "staff", // Specify the exact table name
    timestamps: false, // Disable createdAt/updatedAt if not in your table
    freezeTableName: true, // Prevent Sequelize from pluralizing
  }
);
