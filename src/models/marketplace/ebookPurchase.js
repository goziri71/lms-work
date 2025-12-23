import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const EBookPurchase = db.define(
  "EBookPurchase",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ebook_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to ebooks table",
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to students table - who purchased",
    },
    owner_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
      comment: "Type of e-book owner",
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of e-book owner (sole_tutor.id or organization.id)",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Price student paid for e-book",
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "NGN",
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      comment: "WPU commission percentage at time of purchase",
    },
    wsp_commission: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Amount WPU receives as commission",
    },
    tutor_earnings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Amount tutor/organization receives",
    },
    transaction_ref: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: "Unique transaction reference",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "ebook_purchases",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    freezeTableName: true,
    indexes: [
      {
        fields: ["student_id"],
      },
      {
        fields: ["ebook_id"],
      },
      {
        fields: ["owner_type", "owner_id"],
      },
      {
        fields: ["transaction_ref"],
        unique: true,
      },
    ],
  }
);

