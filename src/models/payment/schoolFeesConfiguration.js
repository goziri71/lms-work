import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const SchoolFeesConfiguration = db.define(
  "SchoolFeesConfiguration",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    academic_year: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "Academic year e.g., '2025/2026'",
    },
    level: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Student level (e.g., '100', '200'). Null means applies to all levels",
    },
    program_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Program ID. Null means applies to all programs",
    },
    faculty_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Faculty ID. Null means applies to all faculties",
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: "School fees amount for this academic year",
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency code",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether this configuration is active",
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Admin ID who created this configuration",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional description/notes",
    },
  },
  {
    tableName: "school_fees_configuration",
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    indexes: [
      {
        unique: true,
        fields: ["academic_year", "level", "program_id", "faculty_id"],
        name: "unique_school_fees_config",
      },
      {
        fields: ["academic_year"],
      },
      {
        fields: ["level"],
      },
      {
        fields: ["program_id"],
      },
      {
        fields: ["faculty_id"],
      },
      {
        fields: ["is_active"],
      },
    ],
  }
);

