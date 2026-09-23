import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const EventActivityLog = db.define(
  "EventActivityLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    actor_type: {
      type: DataTypes.STRING(32),
      allowNull: true,
      comment: "sole_tutor | organization | organization_user | student | guest | system",
    },
    actor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    ticket_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: "event_activity_logs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      { fields: ["event_id", "created_at"] },
      { fields: ["event_id", "action"] },
      { fields: ["order_id"] },
    ],
  }
);
