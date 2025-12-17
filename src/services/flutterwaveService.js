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
 * Can verify by transaction ID (numeric) or transaction reference (txRef)
 * @param {string} transactionIdOrRef - Flutterwave transaction ID (numeric) or transaction reference (txRef)
 * @returns {Promise<Object>} Transaction details from Flutterwave
 */
export const verifyTransaction = async (transactionIdOrRef) => {
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

  // Flutterwave's /transactions/{ref}/verify endpoint works for both:
  // - Numeric transaction IDs (e.g., 1940774374)
  // - Transaction references/txRef (e.g., MC-1765991166356-6uv55yefe)
  // Both use the same GET endpoint
  const verifyUrl = `${FLUTTERWAVE_BASE_URL}/transactions/${transactionIdOrRef}/verify`;

  // Retry logic: Flutterwave transactions may take a few seconds to be available
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds between retries
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(verifyUrl, {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 second timeout
      });

      if (response.data.status === "success" && response.data.data) {
        if (attempt > 1) {
          console.log(
            `✅ Transaction verified on attempt ${attempt} for: ${transactionIdOrRef}`
          );
        }
        return {
          success: true,
          transaction: response.data.data,
        };
      }

      // If response is not successful but not an error, return failure
      return {
        success: false,
        message: response.data.message || "Transaction verification failed",
      };
    } catch (error) {
      lastError = error;

      // If it's a 404/400 (transaction not found), retry with delay
      if (
        (error.response?.status === 404 || error.response?.status === 400) &&
        attempt < maxRetries
      ) {
        const errorMessage = error.response?.data?.message || "";
        if (errorMessage.includes("No transaction was found")) {
          console.log(
            `⏳ Transaction not found yet (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue; // Retry
        }
      }

      // For other errors or last attempt, break and throw
      break;
    }
  }

  // If we get here, all retries failed - log the last error and throw
  if (!lastError) {
    throw new ErrorClass("Transaction verification failed after retries", 500);
  }

  console.error("Flutterwave verification error (after retries):", {
    status: lastError.response?.status,
    statusText: lastError.response?.statusText,
    data: lastError.response?.data,
    message: lastError.message,
    transactionIdOrRef: transactionIdOrRef,
    hasSecretKey: !!FLUTTERWAVE_SECRET_KEY,
    secretKeyPrefix: FLUTTERWAVE_SECRET_KEY
      ? FLUTTERWAVE_SECRET_KEY.substring(0, 10) + "..."
      : "NOT SET",
  });

  if (
    lastError.response?.status === 404 ||
    lastError.response?.status === 400
  ) {
    const errorMessage =
      lastError.response?.data?.message || "Transaction not found";

    // Provide helpful message for transaction not found
    if (errorMessage.includes("No transaction was found")) {
      throw new ErrorClass(
        `Transaction not found with reference: ${transactionIdOrRef} after ${maxRetries} attempts. ` +
          `This might mean: 1) The transaction hasn't been completed yet (wait a few seconds and try again), ` +
          `2) The reference is incorrect, or 3) The transaction is from a different Flutterwave account. ` +
          `Please verify the transaction reference and ensure the payment was completed successfully.`,
        404
      );
    }

    throw new ErrorClass(`Transaction not found: ${errorMessage}`, 404);
  }

  if (lastError.response?.status === 401) {
    const errorMessage =
      lastError.response?.data?.message || "Invalid Flutterwave credentials";

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
    `Flutterwave verification failed after ${maxRetries} attempts: ${lastError.message}`,
    500
  );
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
