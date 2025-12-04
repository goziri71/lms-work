import axios from "axios";
import { ErrorClass } from "../utils/errorClass/index.js";

/**
 * Flutterwave Payment Service
 * Handles payment verification and webhook processing
 */

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY;
const FLUTTERWAVE_BASE_URL = process.env.FLUTTERWAVE_BASE_URL || "https://api.flutterwave.com/v3";

if (!FLUTTERWAVE_SECRET_KEY) {
  console.warn("⚠️  FLUTTERWAVE_SECRET_KEY not set in environment variables");
}

/**
 * Verify transaction with Flutterwave API
 * @param {string} transactionId - Flutterwave transaction ID or reference
 * @returns {Promise<Object>} Transaction details from Flutterwave
 */
export const verifyTransaction = async (transactionId) => {
  if (!FLUTTERWAVE_SECRET_KEY) {
    throw new ErrorClass("Flutterwave secret key not configured", 500);
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
    console.error("Flutterwave verification error:", error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      throw new ErrorClass("Transaction not found", 404);
    }
    
    if (error.response?.status === 401) {
      throw new ErrorClass("Invalid Flutterwave credentials", 401);
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

