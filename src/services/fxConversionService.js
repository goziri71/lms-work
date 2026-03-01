/**
 * FX Conversion Service
 * Handles currency conversion using Flutterwave Real-time FX Rates API
 */

import axios from "axios";
import { ErrorClass } from "../utils/errorClass/index.js";
import { normalizeCurrency } from "./currencyService.js";

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY?.trim();
const FLUTTERWAVE_BASE_URL =
  process.env.FLUTTERWAVE_BASE_URL || "https://api.flutterwave.com/v3";

// Rate cache (in-memory, can be moved to Redis for production)
const rateCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached rate or null if expired/not found
 * @param {string} cacheKey - Cache key (e.g., "USD_NGN")
 * @returns {Object|null} Cached rate object or null
 */
function getCachedRate(cacheKey) {
  const cached = rateCache.get(cacheKey);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_DURATION) {
    rateCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

/**
 * Cache a rate
 * @param {string} cacheKey - Cache key
 * @param {Object} rateData - Rate data to cache
 */
function setCachedRate(cacheKey, rateData) {
  rateCache.set(cacheKey, {
    data: rateData,
    timestamp: Date.now(),
  });
}

/**
 * Get real-time exchange rate from Flutterwave
 * @param {string} sourceCurrency - Source currency code (e.g., 'USD')
 * @param {string} destinationCurrency - Destination currency code (e.g., 'NGN')
 * @param {number} destinationAmount - Optional: Amount in destination currency
 * @returns {Promise<Object>} Rate information
 */
export async function getExchangeRate(
  sourceCurrency,
  destinationCurrency,
  destinationAmount = null
) {
  const source = normalizeCurrency(sourceCurrency);
  const destination = normalizeCurrency(destinationCurrency);

  // Same currency, no conversion needed
  if (source === destination) {
    return {
      rate: 1,
      source: {
        amount: destinationAmount || 0,
        currency: source,
      },
      destination: {
        amount: destinationAmount || 0,
        currency: destination,
      },
    };
  }

  // Check cache
  const cacheKey = `${source}_${destination}${
    destinationAmount ? `_${destinationAmount}` : ""
  }`;
  const cached = getCachedRate(cacheKey);
  if (cached) {
    return cached;
  }

  // Validate Flutterwave key
  if (!FLUTTERWAVE_SECRET_KEY) {
    console.warn("⚠️  FLUTTERWAVE_SECRET_KEY not set, using fallback rate");
    // Return a fallback rate (can be configured)
    return getFallbackRate(source, destination, destinationAmount);
  }

  try {
    // Prepare query parameters for GET request
    // Flutterwave API uses GET with query params
    // Based on Flutterwave docs: GET /v3/transfers/rates?amount=1000&destination_currency=USD&source_currency=KES
    // IMPORTANT: Flutterwave requires 'amount' parameter - use 1 as default if not provided
    const params = new URLSearchParams();
    params.append("source_currency", source);
    params.append("destination_currency", destination);

    // Flutterwave requires amount parameter - use provided amount or default to 1
    const amountToUse = destinationAmount || 1;
    params.append("amount", amountToUse.toString());

    // Call Flutterwave Rates API (GET request)
    // Endpoint: GET /v3/transfers/rates
    const ratesUrl = `${FLUTTERWAVE_BASE_URL}/transfers/rates?${params.toString()}`;

    const response = await axios.get(ratesUrl, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 second timeout
    });

    if (response.data.status === "success" && response.data.data) {
      const data = response.data.data;

      // Flutterwave returns rate data in this format:
      // { rate: number, source: { currency, amount }, destination: { currency, amount } }
      const rateData = {
        rate: parseFloat(data.rate || 1),
        source: {
          amount: parseFloat(data.source?.amount || 0),
          currency: data.source?.currency || source,
        },
        destination: {
          amount: parseFloat(data.destination?.amount || 0),
          currency: data.destination?.currency || destination,
        },
        cached: false,
      };

      // Cache the rate
      setCachedRate(cacheKey, rateData);

      return rateData;
    }

    throw new Error("Invalid response from Flutterwave rates API");
  } catch (error) {
    // Log detailed error information for debugging
    if (error.response) {
      console.error("FX Conversion Error:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url,
        message: error.message,
      });

      // If 404, the endpoint might be wrong or API key doesn't have access
      if (error.response.status === 404) {
        console.error(
          "⚠️  Flutterwave rates endpoint returned 404. Possible issues:"
        );
        console.error("   1. Endpoint URL might be incorrect");
        console.error("   2. API key might not have access to this endpoint");
        console.error("   3. Endpoint might require different authentication");
        console.error(`   Attempted URL: ${error.config?.url}`);
        console.error(
          `   API Key present: ${FLUTTERWAVE_SECRET_KEY ? "Yes" : "No"}`
        );
      }
    } else {
      console.error("FX Conversion Error:", error.message);
    }

    // Return fallback rate on error
    return getFallbackRate(source, destination, destinationAmount);
  }
}

/**
 * Convert amount from one currency to another
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Destination currency code
 * @returns {Promise<Object>} Conversion result
 */
export async function convertCurrency(amount, fromCurrency, toCurrency) {
  if (!amount || amount <= 0) {
    return {
      originalAmount: 0,
      convertedAmount: 0,
      fromCurrency: normalizeCurrency(fromCurrency),
      toCurrency: normalizeCurrency(toCurrency),
      rate: 1,
    };
  }

  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);

  // Same currency
  if (from === to) {
    return {
      originalAmount: amount,
      convertedAmount: amount,
      fromCurrency: from,
      toCurrency: to,
      rate: 1,
    };
  }

  // Get exchange rate for source -> destination pair
  const rateInfo = await getExchangeRate(from, to, amount);

  // Always calculate from explicit source amount to avoid ambiguity in
  // third-party API response semantics (prevents USD 19 -> KES 19 bugs).
  let convertedAmount = amount * rateInfo.rate;

  // Round to 2 decimal places
  convertedAmount = Math.round(convertedAmount * 100) / 100;

  return {
    originalAmount: amount,
    convertedAmount,
    fromCurrency: from,
    toCurrency: to,
    rate: rateInfo.rate,
    rateInfo,
  };
}

/**
 * Get fallback exchange rate (when Flutterwave API is unavailable)
 * @param {string} sourceCurrency - Source currency
 * @param {string} destinationCurrency - Destination currency
 * @param {number} sourceAmountParam - Amount in SOURCE currency (what we're converting from)
 * @returns {Object} Fallback rate with source/destination amounts
 */
function getFallbackRate(
  sourceCurrency,
  destinationCurrency,
  sourceAmountParam = null
) {
  // Common fallback rates (should be updated periodically)
  // These are approximate rates - real rates should come from Flutterwave
  const fallbackRates = {
    USD_NGN: 1500,
    NGN_USD: 1 / 1500,
    USD_GHS: 12,
    GHS_USD: 1 / 12,
    USD_KES: 130,
    KES_USD: 1 / 130,
    USD_ZAR: 18,
    ZAR_USD: 1 / 18,
    USD_GBP: 0.79,
    GBP_USD: 1 / 0.79,
    USD_EUR: 0.92,
    EUR_USD: 1 / 0.92,
    USD_CAD: 1.35,
    CAD_USD: 1 / 1.35,
  };

  const source = normalizeCurrency(sourceCurrency);
  const destination = normalizeCurrency(destinationCurrency);
  const rateKey = `${source}_${destination}`;

  let rate = fallbackRates[rateKey] || 1;

  // If no direct rate, try reverse
  if (rate === 1 && fallbackRates[`${destination}_${source}`]) {
    rate = 1 / fallbackRates[`${destination}_${source}`];
  }

  // Amount passed is in SOURCE currency (e.g. 39 USD). Convert to destination (e.g. 39 * 1500 = 58500 NGN).
  const sourceAmount =
    sourceAmountParam != null ? Number(sourceAmountParam) : null;
  const destAmount = sourceAmount != null ? sourceAmount * rate : null;

  return {
    rate,
    source: {
      amount: sourceAmount ?? 0,
      currency: source,
    },
    destination: {
      amount: destAmount ?? 0,
      currency: destination,
    },
    cached: false,
    fallback: true, // Indicate this is a fallback rate
  };
}

/**
 * Clear rate cache (useful for testing or forced refresh)
 */
export function clearRateCache() {
  rateCache.clear();
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  return {
    size: rateCache.size,
    keys: Array.from(rateCache.keys()),
  };
}
