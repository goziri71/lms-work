import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CurrencyConversion = db.define(
  "CurrencyConversion",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Tutor ID (sole_tutor or organization)",
    },
    tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
      comment: "Type of tutor",
    },
    from_currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      comment: "Source currency code",
    },
    to_currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      comment: "Target currency code",
    },
    from_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Amount converted from",
    },
    to_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Amount converted to",
    },
    exchange_rate: {
      type: DataTypes.DECIMAL(15, 6),
      allowNull: false,
      comment: "Exchange rate used for conversion",
    },
    conversion_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Conversion fee charged (if any)",
    },
    converted_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "When conversion was performed",
    },
  },
  {
    tableName: "currency_conversions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tutor_id", "tutor_type"],
      },
      {
        fields: ["from_currency", "to_currency"],
      },
      {
        fields: ["converted_at"],
      },
    ],
  }
);
