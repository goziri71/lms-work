import { db } from "../database/database.js";
import { DataTypes } from "sequelize";

export const CourseReg = db.define(
  "course_reg",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    academic_year: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    semester: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    date: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    course_reg_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    ref: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    program_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    facaulty_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    level: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
    first_ca: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    second_ca: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    third_ca: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    exam_score: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    registration_status: {
      type: DataTypes.ENUM("allocated", "registered", "marketplace_purchased", "cancelled"),
      allowNull: true,
      defaultValue: "allocated",
      comment:
        "allocated = Admin allocated, registered = Student registered & paid, marketplace_purchased = Purchased from marketplace (lifetime access), cancelled = Cancelled",
      // Note: If ENUM doesn't exist in DB, Sequelize will use VARCHAR
    },
    allocated_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "Price at time of allocation (for historical reference)",
    },
    allocated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When course was allocated to student",
    },
    registered_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When student registered and paid",
    },
  },
  {
    tableName: "course_reg",
    timestamps: false, // Explicitly disable timestamps
    freezeTableName: true,
    indexes: [
      {
        fields: ["registration_status"],
      },
      {
        fields: ["student_id", "academic_year", "semester"],
      },
    ],
  }
);
