import axios from "axios";
import { ErrorClass } from "../utils/errorClass/index.js";

/**
 * Flutterwave Payment Service
 * Handles payment verification and webhook processing
 */

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY?.trim();
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY?.trim();
const FLUTTERWAVE_BASE_URL =
  process.env.FLUTTERWAVE_BASE_URL || "https://api.flutterwave.com/v3";

// Validate Flutterwave key format
const validateFlutterwaveKey = (key, keyType = "secret") => {
  if (!key) return false;

  const trimmedKey = key.trim();

  if (keyType === "secret") {
    // Secret keys should start with FLWSECK_TEST- (test) or FLWSECK- (live)
    return (
      trimmedKey.startsWith("FLWSECK_TEST-") ||
      trimmedKey.startsWith("FLWSECK-")
    );
  } else {
    // Public keys should start with FLWPUBK_TEST- (test) or FLWPUBK- (live)
    return (
      trimmedKey.startsWith("FLWPUBK_TEST-") ||
      trimmedKey.startsWith("FLWPUBK-")
    );
  }
};

if (!FLUTTERWAVE_SECRET_KEY) {
  console.warn("⚠️  FLUTTERWAVE_SECRET_KEY not set in environment variables");
} else if (!validateFlutterwaveKey(FLUTTERWAVE_SECRET_KEY, "secret")) {
  console.warn(
    "⚠️  FLUTTERWAVE_SECRET_KEY format appears invalid. Should start with 'FLWSECK_TEST-' (test) or 'FLWSECK-' (live)"
  );
}

/**
 * Verify transaction with Flutterwave API
 * @param {string} transactionId - Flutterwave transaction ID or reference
 * @returns {Promise<Object>} Transaction details from Flutterwave
 */
export const verifyTransaction = async (transactionId) => {
  if (!FLUTTERWAVE_SECRET_KEY) {
    throw new ErrorClass(
      "Flutterwave secret key not configured. Please set FLUTTERWAVE_SECRET_KEY in your .env file",
      500
    );
  }

  if (!validateFlutterwaveKey(FLUTTERWAVE_SECRET_KEY, "secret")) {
    throw new ErrorClass(
      "Invalid Flutterwave secret key format. Secret key should start with 'FLWSECK_TEST-' (test mode) or 'FLWSECK-' (live mode). " +
        "Please check your FLUTTERWAVE_SECRET_KEY in .env file",
      500
    );
  }

  try {
    const response = await axios.get(
      `${FLUTTERWAVE_BASE_URL}/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status === "success" && response.data.data) {
      return {
        success: true,
        transaction: response.data.data,
      };
    }

    return {
      success: false,
      message: response.data.message || "Transaction verification failed",
    };
  } catch (error) {
    console.error("Flutterwave verification error:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      transactionId: transactionId,
      hasSecretKey: !!FLUTTERWAVE_SECRET_KEY,
      secretKeyPrefix: FLUTTERWAVE_SECRET_KEY
        ? FLUTTERWAVE_SECRET_KEY.substring(0, 10) + "..."
        : "NOT SET",
    });

    if (error.response?.status === 404) {
      throw new ErrorClass("Transaction not found", 404);
    }

    if (error.response?.status === 401) {
      const errorMessage =
        error.response?.data?.message || "Invalid Flutterwave credentials";

      // Provide detailed error message
      let detailedMessage = "Invalid Flutterwave secret key. ";

      if (errorMessage.includes("Invalid secret key")) {
        detailedMessage +=
          "The secret key in your .env file is incorrect or invalid.\n\n";
        detailedMessage += "To fix this:\n";
        detailedMessage += "1. Go to https://dashboard.flutterwave.com\n";
        detailedMessage += "2. Navigate to Settings → API Keys\n";
        detailedMessage +=
          "3. Copy your Secret Key (starts with FLWSECK_TEST- for test or FLWSECK- for live)\n";
        detailedMessage +=
          "4. Update FLUTTERWAVE_SECRET_KEY in your .env file (no quotes, no spaces)\n";
        detailedMessage += "5. Restart your server\n\n";
        detailedMessage += `Current key format: ${
          FLUTTERWAVE_SECRET_KEY
            ? FLUTTERWAVE_SECRET_KEY.substring(0, 20) + "..."
            : "NOT SET"
        }`;
      } else {
        detailedMessage += `Error: ${errorMessage}`;
      }

      throw new ErrorClass(detailedMessage, 401);
    }

    throw new ErrorClass(
      `Flutterwave verification failed: ${error.message}`,
      500
    );
  }
};

/**
 * Verify webhook signature
 * @param {string} signature - Webhook signature from Flutterwave
 * @param {string} payload - Raw request body
 * @returns {boolean} True if signature is valid
 */
export const verifyWebhookSignature = (signature, payload) => {
  if (!FLUTTERWAVE_SECRET_KEY) {
    return false;
  }

  const crypto = require("crypto");
  const hash = crypto
    .createHmac("sha256", FLUTTERWAVE_SECRET_KEY)
    .update(JSON.stringify(payload))
    .digest("hex");

  return hash === signature;
};

/**
 * Get transaction status from Flutterwave response
 * @param {Object} transaction - Transaction object from Flutterwave
 * @returns {string} Transaction status: 'successful', 'failed', 'pending', 'cancelled'
 */
export const getTransactionStatus = (transaction) => {
  if (!transaction) return "failed";

  const status = transaction.status?.toLowerCase();
  const paymentStatus = transaction.payment_status?.toLowerCase();

  // Check payment status first
  if (paymentStatus === "successful" || status === "successful") {
    return "successful";
  }

  if (paymentStatus === "failed" || status === "failed") {
    return "failed";
  }

  if (paymentStatus === "pending" || status === "pending") {
    return "pending";
  }

  if (paymentStatus === "cancelled" || status === "cancelled") {
    return "cancelled";
  }

  return "failed";
};

/**
 * Check if transaction is successful
 * @param {Object} transaction - Transaction object from Flutterwave
 * @returns {boolean} True if transaction is successful
 */
export const isTransactionSuccessful = (transaction) => {
  return getTransactionStatus(transaction) === "successful";
};

/**
 * Get transaction amount from Flutterwave response
 * @param {Object} transaction - Transaction object from Flutterwave
 * @returns {number} Transaction amount
 */
export const getTransactionAmount = (transaction) => {
  return parseFloat(transaction.amount || transaction.charged_amount || 0);
};

/**
 * Get transaction currency from Flutterwave response
 * @param {Object} transaction - Transaction object from Flutterwave
 * @returns {string} Currency code (e.g., 'NGN')
 */
export const getTransactionCurrency = (transaction) => {
  return transaction.currency || "NGN";
};

/**
 * Get transaction reference from Flutterwave response
 * @param {Object} transaction - Transaction object from Flutterwave
 * @returns {string} Transaction reference
 */
export const getTransactionReference = (transaction) => {
  return transaction.tx_ref || transaction.txRef || transaction.id?.toString();
};
