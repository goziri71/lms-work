import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const TutorBankAccount = db.define(
  "TutorBankAccount",
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
    account_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Account holder name",
    },
    account_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "Bank account number",
    },
    bank_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "Flutterwave bank code",
    },
    bank_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Bank name",
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Country code (e.g., 'NG', 'GH', 'KE')",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency code (e.g., 'NGN', 'GHS', 'KES')",
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether account has been verified",
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Primary account for payouts",
    },
    verification_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when account was verified",
    },
    verification_response: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Response from Flutterwave verification",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tutor_bank_accounts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tutor_id", "tutor_type"],
      },
      {
        fields: ["is_primary"],
      },
      {
        fields: ["is_verified"],
      },
    ],
  }
);

