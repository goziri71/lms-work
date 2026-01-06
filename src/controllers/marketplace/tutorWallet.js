import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { TutorWalletTransaction } from "../../models/marketplace/tutorWalletTransaction.js";
import { Op } from "sequelize";
import {
  verifyTransaction,
  isTransactionSuccessful,
  getTransactionAmount,
  getTransactionCurrency,
  getTransactionReference,
} from "../../services/flutterwaveService.js";
import { db } from "../../database/database.js";

/**
 * Get tutor wallet balance
 * GET /api/marketplace/tutor/wallet/balance
 */
export const getWalletBalance = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;

  const walletBalance = parseFloat(tutor.wallet_balance || 0);
  const currency = tutor.currency || "NGN";

  res.status(200).json({
    success: true,
    message: "Wallet balance retrieved successfully",
    data: {
      wallet_balance: walletBalance,
      currency: currency,
    },
  });
});

/**
 * Fund tutor wallet via Flutterwave
 * Frontend sends transaction reference from Flutterwave callback
 * Backend verifies with Flutterwave API and credits wallet if successful
 * POST /api/marketplace/tutor/wallet/fund
 */
export const fundWallet = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;
  const tutorType = userType === "sole_tutor" ? "sole_tutor" : "organization";

  // Frontend sends transaction reference from Flutterwave callback
  const { transaction_reference, flutterwave_transaction_id, amount } = req.body || {};

  if (!transaction_reference && !flutterwave_transaction_id) {
    throw new ErrorClass(
      "transaction_reference or flutterwave_transaction_id is required",
      400
    );
  }

  // Verify transaction with Flutterwave API
  const verificationId = flutterwave_transaction_id || transaction_reference;
  let verificationResult;

  try {
    verificationResult = await verifyTransaction(verificationId);
  } catch (error) {
    throw new ErrorClass(`Payment verification failed: ${error.message}`, 400);
  }

  if (
    !verificationResult.success ||
    !isTransactionSuccessful(verificationResult.transaction)
  ) {
    throw new ErrorClass("Payment was not successful", 400);
  }

  const flutterwaveTransaction = verificationResult.transaction;

  // Get transaction amount and currency
  const transactionAmount = getTransactionAmount(flutterwaveTransaction);
  const transactionCurrency = getTransactionCurrency(flutterwaveTransaction);

  // If amount is provided in request, verify it matches
  if (amount && Math.abs(parseFloat(amount) - transactionAmount) > 0.01) {
    throw new ErrorClass(
      `Payment amount mismatch. Expected: ${amount}, Received: ${transactionAmount}`,
      400
    );
  }

  // Check if transaction reference already processed (idempotency)
  const txRef = getTransactionReference(flutterwaveTransaction);
  const existingTransaction = await TutorWalletTransaction.findOne({
    where: {
      [Op.or]: [
        { transaction_reference: txRef },
        { flutterwave_transaction_id: flutterwaveTransaction.id?.toString() },
      ],
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: "successful",
      transaction_type: "credit",
    },
  });

  if (existingTransaction) {
    // Return existing transaction info
    await tutor.reload();
    const currentBalance = parseFloat(tutor.wallet_balance || 0);

    return res.status(200).json({
      success: true,
      message: "Wallet funding already processed",
      data: {
        transaction: {
          transaction_reference: txRef,
          status: "successful",
          amount: transactionAmount,
        },
        wallet: {
          balance: currentBalance,
          currency: transactionCurrency,
        },
      },
    });
  }

  // Use transaction to ensure atomicity
  const transaction = await db.transaction();

  try {
    // Get current wallet balance
    const balanceBefore = parseFloat(tutor.wallet_balance || 0);

    // Credit wallet
    const balanceAfter = balanceBefore + transactionAmount;

    // Update tutor wallet_balance
    if (tutorType === "sole_tutor") {
      await SoleTutor.update(
        { wallet_balance: balanceAfter },
        { where: { id: tutorId }, transaction }
      );
    } else {
      await Organization.update(
        { wallet_balance: balanceAfter },
        { where: { id: tutorId }, transaction }
      );
    }

    // Create wallet transaction record
    await TutorWalletTransaction.create(
      {
        tutor_id: tutorId,
        tutor_type: tutorType,
        transaction_type: "credit",
        amount: transactionAmount,
        currency: transactionCurrency,
        service_name: "Wallet Funding",
        transaction_reference: txRef,
        flutterwave_transaction_id: flutterwaveTransaction.id?.toString(),
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: "successful",
        metadata: {
          flutterwave_response: flutterwaveTransaction,
        },
      },
      { transaction }
    );

    await transaction.commit();

    // Reload tutor to get updated balance
    await tutor.reload();

    res.status(200).json({
      success: true,
      message: "Wallet funded successfully",
      data: {
        transaction: {
          transaction_reference: txRef,
          amount: transactionAmount,
          currency: transactionCurrency,
        },
        wallet: {
          previous_balance: balanceBefore,
          new_balance: balanceAfter,
          credited: transactionAmount,
          currency: transactionCurrency,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Get tutor wallet transaction history
 * GET /api/marketplace/tutor/wallet/transactions
 */
export const getWalletTransactions = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;
  const tutorType = userType === "sole_tutor" ? "sole_tutor" : "organization";

  // Get query parameters for filtering
  const {
    page = 1,
    limit = 20,
    transaction_type, // credit or debit
    status,
    start_date,
    end_date,
  } = req.query;

  // Build where clause
  const where = {
    tutor_id: tutorId,
    tutor_type: tutorType,
  };

  if (transaction_type) {
    where.transaction_type = transaction_type;
  }

  if (status) {
    where.status = status;
  }

  // Date filtering
  if (start_date || end_date) {
    where.created_at = {};
    if (start_date) {
      where.created_at[Op.gte] = new Date(start_date);
    }
    if (end_date) {
      where.created_at[Op.lte] = new Date(end_date);
    }
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Get wallet transactions with pagination
  const { count, rows: transactions } = await TutorWalletTransaction.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["created_at", "DESC"]],
  });

  const currency = tutor.currency || "NGN";

  // Calculate summary
  const totalCredits = await TutorWalletTransaction.sum("amount", {
    where: { ...where, transaction_type: "credit", status: "successful" },
  });

  const totalDebits = await TutorWalletTransaction.sum("amount", {
    where: { ...where, transaction_type: "debit", status: "successful" },
  });

  res.status(200).json({
    success: true,
    message: "Wallet transactions retrieved successfully",
    data: {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        transaction_type: tx.transaction_type,
        amount: parseFloat(tx.amount || 0),
        currency: tx.currency || currency,
        service_name: tx.service_name,
        transaction_reference: tx.transaction_reference,
        balance_before: parseFloat(tx.balance_before || 0),
        balance_after: parseFloat(tx.balance_after || 0),
        related_id: tx.related_id,
        related_type: tx.related_type,
        status: tx.status,
        notes: tx.notes,
        created_at: tx.created_at,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
      summary: {
        currency: currency,
        total_credits: parseFloat(totalCredits || 0),
        total_debits: parseFloat(totalDebits || 0),
        current_balance: parseFloat(tutor.wallet_balance || 0),
      },
    },
  });
});

