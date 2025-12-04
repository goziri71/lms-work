import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const PaymentTransaction = db.define(
  "PaymentTransaction",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Student who initiated the payment",
    },
    transaction_reference: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: "Unique transaction reference (tx_ref from Flutterwave)",
    },
    flutterwave_transaction_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Flutterwave transaction ID",
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: "Payment amount",
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency code",
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "processing",
        "successful",
        "failed",
        "cancelled",
        "expired"
      ),
      allowNull: false,
      defaultValue: "pending",
      comment: "Payment status",
    },
    payment_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "school_fees",
      comment: "Type of payment (school_fees, course_registration, etc.)",
    },
    academic_year: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Academic year for school fees",
    },
    verification_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of verification attempts",
    },
    last_verification_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Last verification attempt timestamp",
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Error message if payment failed",
    },
    flutterwave_response: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Full response from Flutterwave API",
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When payment was successfully processed",
    },
  },
  {
    tableName: "payment_transactions",
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    indexes: [
      {
        unique: true,
        fields: ["transaction_reference"],
        name: "unique_transaction_reference",
      },
      {
        fields: ["student_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["payment_type"],
      },
      {
        fields: ["flutterwave_transaction_id"],
      },
      {
        fields: ["created_at"],
      },
    ],
  }
);

