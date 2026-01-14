import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CurrencyExchangeRate = db.define(
  "CurrencyExchangeRate",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    from_currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      comment: "Source currency code (e.g., 'NGN', 'USD', 'GBP')",
    },
    to_currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      comment: "Target currency code",
    },
    rate: {
      type: DataTypes.DECIMAL(15, 6),
      allowNull: false,
      comment: "Exchange rate (1 from_currency = rate to_currency)",
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "api",
      comment: "Source of exchange rate (e.g., 'api', 'manual', 'fixer.io')",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether this rate is currently active",
    },
  },
  {
    tableName: "currency_exchange_rates",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["from_currency", "to_currency"],
        name: "unique_currency_pair",
      },
      {
        fields: ["is_active"],
      },
      {
        fields: ["updated_at"],
      },
    ],
  }
);
