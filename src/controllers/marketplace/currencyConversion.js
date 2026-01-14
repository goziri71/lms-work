/**
 * Currency Conversion Controller
 * Handles currency conversion between tutor wallets
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { CurrencyConversion } from "../../models/marketplace/currencyConversion.js";
import { convertAmount, getExchangeRate } from "../../services/currencyExchangeRateService.js";
import { db } from "../../database/database.js";

/**
 * Convert currency between tutor wallets
 * POST /api/marketplace/tutor/wallet/convert
 */
export const convertCurrency = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;
  const tutorType = userType === "sole_tutor" ? "sole_tutor" : "organization";

  const { from_currency, to_currency, amount } = req.body;

  // Validate input
  if (!from_currency || !to_currency || !amount) {
    throw new ErrorClass("from_currency, to_currency, and amount are required", 400);
  }

  const fromCurrency = from_currency.toUpperCase();
  const toCurrency = to_currency.toUpperCase();
  const amountToConvert = parseFloat(amount);

  if (amountToConvert <= 0) {
    throw new ErrorClass("Amount must be greater than 0", 400);
  }

  if (fromCurrency === toCurrency) {
    throw new ErrorClass("Cannot convert to the same currency", 400);
  }

  // Validate currency codes
  const validCurrencies = ["NGN", "USD", "GBP"];
  if (!validCurrencies.includes(fromCurrency) || !validCurrencies.includes(toCurrency)) {
    throw new ErrorClass("Invalid currency. Supported: NGN, USD, GBP", 400);
  }

  // Get current wallet balances
  const primaryBalance = parseFloat(tutor.wallet_balance_primary || 0);
  const usdBalance = parseFloat(tutor.wallet_balance_usd || 0);
  const gbpBalance = parseFloat(tutor.wallet_balance_gbp || 0);

  // Check source wallet balance
  let sourceBalance;
  if (fromCurrency === "USD") {
    sourceBalance = usdBalance;
  } else if (fromCurrency === "GBP") {
    sourceBalance = gbpBalance;
  } else {
    // Primary wallet (local currency)
    sourceBalance = primaryBalance;
  }

  if (sourceBalance < amountToConvert) {
    throw new ErrorClass(
      `Insufficient balance in ${fromCurrency} wallet. Available: ${sourceBalance}, Required: ${amountToConvert}`,
      400
    );
  }

  // Get exchange rate
  const exchangeRate = await getExchangeRate(fromCurrency, toCurrency);
  if (!exchangeRate) {
    throw new ErrorClass(
      `Exchange rate not available for ${fromCurrency} -> ${toCurrency}. Please try again later.`,
      503
    );
  }

  // Calculate converted amount
  const conversionResult = await convertAmount(amountToConvert, fromCurrency, toCurrency);
  const convertedAmount = conversionResult.to_amount;

  // Conversion fee (can be configured, default: 0.5%)
  const conversionFeePercent = parseFloat(process.env.CURRENCY_CONVERSION_FEE_PERCENT || "0.5");
  const feeAmount = parseFloat((amountToConvert * (conversionFeePercent / 100)).toFixed(2));
  const amountAfterFee = amountToConvert - feeAmount;
  const finalConvertedAmount = parseFloat((amountAfterFee * exchangeRate).toFixed(2));

  // Use transaction to ensure atomicity
  const transaction = await db.transaction();

  try {
    // Prepare update fields
    const updateFields = {};

    // Deduct from source wallet
    if (fromCurrency === "USD") {
      updateFields.wallet_balance_usd = usdBalance - amountToConvert;
    } else if (fromCurrency === "GBP") {
      updateFields.wallet_balance_gbp = gbpBalance - amountToConvert;
    } else {
      updateFields.wallet_balance_primary = primaryBalance - amountToConvert;
    }

    // Credit to destination wallet
    if (toCurrency === "USD") {
      updateFields.wallet_balance_usd = (usdBalance || 0) + finalConvertedAmount;
    } else if (toCurrency === "GBP") {
      updateFields.wallet_balance_gbp = (gbpBalance || 0) + finalConvertedAmount;
    } else {
      updateFields.wallet_balance_primary = (primaryBalance || 0) + finalConvertedAmount;
    }

    // Update tutor wallet balances
    if (tutorType === "sole_tutor") {
      await SoleTutor.update(updateFields, { where: { id: tutorId }, transaction });
    } else {
      await Organization.update(updateFields, { where: { id: tutorId }, transaction });
    }

    // Create conversion record
    await CurrencyConversion.create(
      {
        tutor_id: tutorId,
        tutor_type: tutorType,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        from_amount: amountToConvert,
        to_amount: finalConvertedAmount,
        exchange_rate: exchangeRate,
        conversion_fee: feeAmount,
      },
      { transaction }
    );

    await transaction.commit();

    // Reload tutor to get updated balances
    await tutor.reload();

    res.status(200).json({
      success: true,
      message: "Currency converted successfully",
      data: {
        conversion: {
          from_currency: fromCurrency,
          to_currency: toCurrency,
          from_amount: amountToConvert,
          to_amount: finalConvertedAmount,
          exchange_rate: parseFloat(exchangeRate.toFixed(6)),
          fee_amount: feeAmount,
          fee_percent: conversionFeePercent,
        },
        wallets: {
          [fromCurrency.toLowerCase()]: {
            before: sourceBalance,
            after: sourceBalance - amountToConvert,
            currency: fromCurrency,
          },
          [toCurrency.toLowerCase()]: {
            before: fromCurrency === "USD" ? usdBalance : fromCurrency === "GBP" ? gbpBalance : primaryBalance,
            after:
              toCurrency === "USD"
                ? parseFloat(tutor.wallet_balance_usd || 0)
                : toCurrency === "GBP"
                ? parseFloat(tutor.wallet_balance_gbp || 0)
                : parseFloat(tutor.wallet_balance_primary || 0),
            currency: toCurrency,
          },
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Get exchange rate for conversion preview
 * GET /api/marketplace/tutor/wallet/convert/rate
 */
export const getConversionRate = TryCatchFunction(async (req, res) => {
  const { from_currency, to_currency, amount } = req.query;

  if (!from_currency || !to_currency) {
    throw new ErrorClass("from_currency and to_currency are required", 400);
  }

  const fromCurrency = from_currency.toUpperCase();
  const toCurrency = to_currency.toUpperCase();
  const previewAmount = amount ? parseFloat(amount) : 1;

  if (fromCurrency === toCurrency) {
    return res.status(200).json({
      success: true,
      data: {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate: 1,
        from_amount: previewAmount,
        to_amount: previewAmount,
        fee_amount: 0,
        fee_percent: 0,
      },
    });
  }

  // Get exchange rate
  const exchangeRate = await getExchangeRate(fromCurrency, toCurrency);
  if (!exchangeRate) {
    throw new ErrorClass(
      `Exchange rate not available for ${fromCurrency} -> ${toCurrency}. Please try again later.`,
      503
    );
  }

  // Calculate conversion with fee
  const conversionFeePercent = parseFloat(process.env.CURRENCY_CONVERSION_FEE_PERCENT || "0.5");
  const feeAmount = parseFloat((previewAmount * (conversionFeePercent / 100)).toFixed(2));
  const amountAfterFee = previewAmount - feeAmount;
  const convertedAmount = parseFloat((amountAfterFee * exchangeRate).toFixed(2));

  res.status(200).json({
    success: true,
    data: {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      rate: parseFloat(exchangeRate.toFixed(6)),
      from_amount: previewAmount,
      to_amount: convertedAmount,
      fee_amount: feeAmount,
      fee_percent: conversionFeePercent,
      last_updated: new Date(),
    },
  });
});

/**
 * Get conversion history
 * GET /api/marketplace/tutor/wallet/convert/history
 */
export const getConversionHistory = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;
  const tutorType = userType === "sole_tutor" ? "sole_tutor" : "organization";

  const { page = 1, limit = 20, from_currency, to_currency } = req.query;

  const where = {
    tutor_id: tutorId,
    tutor_type: tutorType,
  };

  if (from_currency) {
    where.from_currency = from_currency.toUpperCase();
  }

  if (to_currency) {
    where.to_currency = to_currency.toUpperCase();
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: conversions } = await CurrencyConversion.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["converted_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Conversion history retrieved successfully",
    data: {
      conversions: conversions.map((conv) => ({
        id: conv.id,
        from_currency: conv.from_currency,
        to_currency: conv.to_currency,
        from_amount: parseFloat(conv.from_amount || 0),
        to_amount: parseFloat(conv.to_amount || 0),
        exchange_rate: parseFloat(conv.exchange_rate || 0),
        fee_amount: parseFloat(conv.conversion_fee || 0),
        converted_at: conv.converted_at,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});
