import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const EventTicketCoupon = db.define(
  "EventTicketCoupon",
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
    code: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: "Uppercase promo code, unique per event",
    },
    discount_type: {
      type: DataTypes.ENUM("percent", "fixed"),
      allowNull: false,
    },
    discount_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    max_uses: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Null = unlimited redemptions",
    },
    uses_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    one_per_email: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    tier_ids: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "If set, only these tier ids get the coupon; null = all paid tiers",
    },
    starts_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "event_ticket_coupons",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["event_id"] },
      { unique: true, fields: ["event_id", "code"] },
    ],
  }
);
