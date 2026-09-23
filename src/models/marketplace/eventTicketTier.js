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
    benefits: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: "List of package benefits set by the creator (e.g. VIP seating, merch)",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Creator-defined list price (not a fixed platform price); 0 = free RSVP",
    },
    discount_type: {
      type: DataTypes.ENUM("none", "percent", "fixed"),
      allowNull: false,
      defaultValue: "none",
      comment: "Discount on paid tickets only: percent or fixed amount off list price",
    },
    discount_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Percent 0-100, or fixed amount in tier currency",
    },
    discount_starts_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    discount_ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
