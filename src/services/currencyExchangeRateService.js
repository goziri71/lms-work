/**
 * Currency Exchange Rate Service
 * Handles fetching and updating exchange rates from external APIs
 */

import { CurrencyExchangeRate } from "../models/marketplace/currencyExchangeRate.js";
import { Op } from "sequelize";

// Exchange rate API configuration
const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY || process.env.FIXER_API_KEY;
const EXCHANGE_RATE_API_URL = process.env.EXCHANGE_RATE_API_URL || "https://api.fixer.io/v1/latest";
const EXCHANGE_RATE_API_PROVIDER = process.env.EXCHANGE_RATE_API_PROVIDER || "fixer.io"; // fixer.io, exchangerate-api, etc.

// Supported currency pairs for tutor wallets
const REQUIRED_CURRENCY_PAIRS = [
  { from: "NGN", to: "USD" },
  { from: "NGN", to: "GBP" },
  { from: "USD", to: "NGN" },
  { from: "USD", to: "GBP" },
  { from: "GBP", to: "NGN" },
  { from: "GBP", to: "USD" },
];

/**
 * Get exchange rate from Fixer.io API
 */
async function fetchRatesFromFixer() {
  if (!EXCHANGE_RATE_API_KEY) {
    throw new Error("Exchange rate API key not configured");
  }

  try {
    // Fixer.io free tier supports base currency (default: EUR)
    // We need to get rates for EUR -> NGN, USD, GBP, then calculate cross-rates
    const response = await fetch(
      `${EXCHANGE_RATE_API_URL}?access_key=${EXCHANGE_RATE_API_KEY}&base=EUR&symbols=NGN,USD,GBP`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Fixer.io API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success && data.error) {
      throw new Error(`Fixer.io API error: ${data.error.info || data.error.type}`);
    }

    const rates = data.rates || {};
    const eurToNgn = rates.NGN || 1;
    const eurToUsd = rates.USD || 1;
    const eurToGbp = rates.GBP || 1;

    // Calculate cross-rates
    return {
      NGN_USD: eurToUsd / eurToNgn,
      NGN_GBP: eurToGbp / eurToNgn,
      USD_NGN: eurToNgn / eurToUsd,
      USD_GBP: eurToGbp / eurToUsd,
      GBP_NGN: eurToNgn / eurToGbp,
      GBP_USD: eurToUsd / eurToGbp,
    };
  } catch (error) {
    console.error("Error fetching rates from Fixer.io:", error);
    throw error;
  }
}

/**
 * Get exchange rate from ExchangeRate-API (free alternative)
 */
async function fetchRatesFromExchangeRateAPI() {
  try {
    // ExchangeRate-API free tier: https://api.exchangerate-api.com/v4/latest/USD
    // We'll fetch USD base and calculate others
    const usdResponse = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    const usdData = await usdResponse.json();

    if (!usdData.rates) {
      throw new Error("Invalid response from ExchangeRate-API");
    }

    const rates = usdData.rates;
    const usdToNgn = rates.NGN || 1;
    const usdToGbp = rates.GBP || 1;

    // Calculate cross-rates
    return {
      NGN_USD: 1 / usdToNgn,
      NGN_GBP: usdToGbp / usdToNgn,
      USD_NGN: usdToNgn,
      USD_GBP: usdToGbp,
      GBP_NGN: usdToNgn / usdToGbp,
      GBP_USD: 1 / usdToGbp,
    };
  } catch (error) {
    console.error("Error fetching rates from ExchangeRate-API:", error);
    throw error;
  }
}

/**
 * Update exchange rates in database
 * Fetches latest rates from API and updates database
 */
export async function updateExchangeRates() {
  console.log("🔄 Updating exchange rates...");

  let rates = {};

  try {
    // Try Fixer.io first if API key is configured
    if (EXCHANGE_RATE_API_KEY && EXCHANGE_RATE_API_PROVIDER === "fixer.io") {
      rates = await fetchRatesFromFixer();
    } else {
      // Fallback to free ExchangeRate-API
      rates = await fetchRatesFromExchangeRateAPI();
    }

    // Update rates in database
    const updates = [];

    for (const pair of REQUIRED_CURRENCY_PAIRS) {
      const rateKey = `${pair.from}_${pair.to}`;
      const rate = rates[rateKey];

      if (!rate || rate <= 0) {
        console.warn(`⚠️  Invalid rate for ${pair.from} -> ${pair.to}: ${rate}`);
        continue;
      }

      // Update or create rate
      const [exchangeRate, created] = await CurrencyExchangeRate.upsert(
        {
          from_currency: pair.from,
          to_currency: pair.to,
          rate: parseFloat(rate.toFixed(6)),
          source: EXCHANGE_RATE_API_PROVIDER,
          is_active: true,
        },
        {
          conflictFields: ["from_currency", "to_currency"],
        }
      );

      updates.push({
        pair: `${pair.from} -> ${pair.to}`,
        rate: rate.toFixed(6),
        created,
      });
    }

    console.log(`✅ Updated ${updates.length} exchange rates`);
    return {
      success: true,
      updated: updates.length,
      rates: updates,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("❌ Failed to update exchange rates:", error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date(),
    };
  }
}

/**
 * Get exchange rate from database
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @returns {Promise<number|null>} Exchange rate or null if not found
 */
export async function getExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  const rate = await CurrencyExchangeRate.findOne({
    where: {
      from_currency: fromCurrency.toUpperCase(),
      to_currency: toCurrency.toUpperCase(),
      is_active: true,
    },
    order: [["updated_at", "DESC"]],
  });

  return rate ? parseFloat(rate.rate) : null;
}

/**
 * Get all active exchange rates
 * @returns {Promise<Array>} Array of exchange rates
 */
export async function getAllExchangeRates() {
  return await CurrencyExchangeRate.findAll({
    where: {
      is_active: true,
    },
    order: [["from_currency", "ASC"], ["to_currency", "ASC"]],
  });
}

/**
 * Convert amount between currencies
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @returns {Promise<Object>} Conversion result
 */
export async function convertAmount(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return {
      from_amount: amount,
      to_amount: amount,
      from_currency: fromCurrency,
      to_currency: toCurrency,
      rate: 1,
    };
  }

  const rate = await getExchangeRate(fromCurrency, toCurrency);

  if (!rate) {
    throw new Error(`Exchange rate not found for ${fromCurrency} -> ${toCurrency}`);
  }

  const convertedAmount = parseFloat((amount * rate).toFixed(2));

  return {
    from_amount: amount,
    to_amount: convertedAmount,
    from_currency: fromCurrency.toUpperCase(),
    to_currency: toCurrency.toUpperCase(),
    rate: parseFloat(rate.toFixed(6)),
  };
}
