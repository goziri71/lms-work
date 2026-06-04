import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const EventTicketOrder = db.define(
  "EventTicketOrder",
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
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "students", key: "id" },
      onDelete: "SET NULL",
    },
    buyer_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    buyer_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    buyer_phone: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "paid",
        "failed",
        "cancelled",
        "refunded"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
    },
    ticket_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    line_items: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: "[{ tier_id, tier_name, quantity, unit_price, subtotal }]",
    },
    payment_method: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    transaction_ref: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    flutterwave_transaction_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    access_token: {
      type: DataTypes.STRING(128),
      allowNull: true,
      unique: true,
      comment: "Magic link token for guest ticket access",
    },
    idempotency_key: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    reservation_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    platform_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    tutor_earnings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "event_ticket_orders",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["event_id"] },
      { fields: ["student_id"] },
      { fields: ["buyer_email"] },
      { fields: ["status"] },
      { fields: ["access_token"] },
    ],
  }
);
