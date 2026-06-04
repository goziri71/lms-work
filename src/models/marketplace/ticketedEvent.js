import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const TicketedEvent = db.define(
  "TicketedEvent",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    owner_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    format: {
      type: DataTypes.ENUM("online", "in_person", "hybrid"),
      allowNull: false,
      defaultValue: "online",
    },
    timezone: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: "Africa/Lagos",
    },
    starts_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    ends_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    doors_open_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    venue_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    address_line1: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    region: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    online_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Revealed to ticket holders after purchase",
    },
    cover_image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "draft",
        "published",
        "sold_out",
        "cancelled",
        "completed"
      ),
      allowNull: false,
      defaultValue: "draft",
    },
    refund_policy: {
      type: DataTypes.STRING(64),
      allowNull: true,
      defaultValue: "none",
    },
    refund_policy_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    max_attendees: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "ticketed_events",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["owner_type", "owner_id"] },
      { fields: ["status"] },
      { fields: ["starts_at"] },
      { unique: true, fields: ["slug"] },
    ],
  }
);
