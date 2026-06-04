import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const EventTicket = db.define(
  "EventTicket",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "event_ticket_orders", key: "id" },
      onDelete: "CASCADE",
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "ticketed_events", key: "id" },
      onDelete: "CASCADE",
    },
    tier_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "event_ticket_tiers", key: "id" },
      onDelete: "CASCADE",
    },
    ticket_code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    holder_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    holder_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("valid", "used", "cancelled"),
      allowNull: false,
      defaultValue: "valid",
    },
    checked_in_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    checked_in_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Tutor or org user id who checked in",
    },
  },
  {
    tableName: "event_tickets",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["order_id"] },
      { fields: ["event_id"] },
      { fields: ["ticket_code"] },
      { unique: true, fields: ["ticket_code"] },
    ],
  }
);
