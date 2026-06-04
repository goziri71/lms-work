import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const EventTicketTier = db.define(
  "EventTicketTier",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "ticketed_events", key: "id" },
      onDelete: "CASCADE",
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
    },
    quantity_total: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    quantity_sold: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    quantity_reserved: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    max_per_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 4,
    },
    sales_start: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sales_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_hidden: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "event_ticket_tiers",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ fields: ["event_id"] }],
  }
);
