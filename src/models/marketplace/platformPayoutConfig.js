import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

/**
 * Singleton row (id = 1): NGN platform fee applied before Flutterwave on NGN payouts.
 * Update via SQL or admin tooling: UPDATE platform_payout_config SET ngn_payout_platform_fee = 100 WHERE id = 1;
 */
export const PlatformPayoutConfig = db.define(
  "PlatformPayoutConfig",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      defaultValue: 1,
    },
    ngn_payout_platform_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 100.0,
      comment: "Flat NGN fee per NGN payout (before Flutterwave)",
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "platform_payout_config",
    timestamps: false,
    updatedAt: false,
    createdAt: false,
  }
);
