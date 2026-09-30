import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const MarketplaceGuestOrder = db.define(
  "MarketplaceGuestOrder",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    product_type: {
      type: DataTypes.ENUM("course", "digital_download"),
      allowNull: false,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    product_title: {
      type: DataTypes.STRING(500),
      allowNull: true,
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
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "students", key: "id" },
      onDelete: "SET NULL",
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
    owner_type: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    access_token: {
      type: DataTypes.STRING(128),
      allowNull: true,
      unique: true,
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
    entitlement_created: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Course reg or digital purchase row created for buyer",
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "marketplace_guest_orders",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["buyer_email"] },
      { fields: ["product_type", "product_id"] },
      { fields: ["status"] },
      { fields: ["access_token"] },
      { fields: ["student_id"] },
    ],
  }
);
