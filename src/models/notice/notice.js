import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Notice = db.define(
  "Notice",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
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
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the notice expires. Null if permanent.",
    },
    is_permanent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "If true, notice never expires regardless of expires_at",
    },
    status: {
      type: DataTypes.ENUM("active", "expired", "draft"),
      allowNull: false,
      defaultValue: "active",
      comment: "active = visible, expired = hidden, draft = not published",
    },
    target_audience: {
      type: DataTypes.ENUM("all", "students", "staff", "both"),
      allowNull: false,
      defaultValue: "all",
      comment: "Who can see this notice: all, students only, staff only, or both",
    },
  },
  {
    tableName: "notice",
    freezeTableName: true,
    timestamps: false, // Using 'date' instead of timestamps
  }
);

