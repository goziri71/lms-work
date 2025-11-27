import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CourseSemesterPricing = db.define(
  "CourseSemesterPricing",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Foreign key to courses table",
    },
    academic_year: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "Academic year e.g., '2025/2026'",
    },
    semester: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "Semester e.g., '1ST' or '2ND'",
    },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: "Price for this course in this semester",
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency code",
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Admin ID who set this price",
    },
  },
  {
    tableName: "course_semester_pricing",
    timestamps: true,
    freezeTableName: true,
    indexes: [
      {
        unique: true,
        fields: ["course_id", "academic_year", "semester"],
        name: "unique_course_semester_pricing",
      },
      {
        fields: ["academic_year", "semester"],
      },
      {
        fields: ["course_id"],
      },
    ],
  }
);

