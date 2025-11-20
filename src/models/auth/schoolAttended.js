import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const SchoolAttended = db.define(
  "SchoolAttended",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    school: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    study_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    year_from: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    year_to: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "school_attended",
    freezeTableName: true,
    timestamps: false,
  }
);

