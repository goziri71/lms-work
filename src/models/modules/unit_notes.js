import { dbLibrary } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const UnitNotes = dbLibrary.define(
  "unit_notes",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    unit_id: { type: DataTypes.INTEGER, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: false },
    note_text: { type: DataTypes.TEXT, allowNull: false },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "unit_notes",
    timestamps: false,
    freezeTableName: true,
    indexes: [{ unique: true, fields: ["unit_id", "student_id"] }],
  }
);
