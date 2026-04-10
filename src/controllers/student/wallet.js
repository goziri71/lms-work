import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { Funding } from "../../models/payment/funding.js";
import { Semester } from "../../models/auth/semester.js";
import { GeneralSetup } from "../../models/settings/generalSetup.js";
import {
  verifyTransaction,
  isTransactionSuccessful,
  getTransactionAmount,
  getTransactionCurrency,
  getTransactionReference,
  getTransactionStatus,
} from "../../services/flutterwaveService.js";
import {
  getWalletBalance as getWalletBalanceService,
  fundStudentWalletFromFlutterwave,
  fundingCurrencyWhere,
} from "../../services/walletBalanceService.js";

/**
 * Get student's wallet balance
 * GET /api/wallet/balance
 */
export const getWalletBalance = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  // Get student
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get wallet balance (with automatic migration of old balances)
  const { balance: walletBalance, migrated } = await getWalletBalanceService(
    studentId,
    true,
  );

  res.status(200).json({
    success: true,
    message: "Wallet balance retrieved successfully",
    data: {
      wallet_balance: walletBalance,
      currency: student.currency || "NGN",
      migrated: migrated, // Indicates if old balance was migrated
    },
  });
});

/**
 * Verify and fund wallet via Flutterwave
 * Frontend sends transaction reference from Flutterwave callback
 * Backend verifies with Flutterwave API and credits wallet if successful
 * POST /api/wallet/fund
 *
 * Response data.outcome: "completed" | "pending" | "pending_verification" | "failed"
 * — Treat only outcome "completed" as credited. On pending/pending_verification, retry with the same ref.
 */
export const fundWallet = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can fund wallet", 403);
  }

  // Frontend sends transaction reference from Flutterwave callback
  const { transaction_reference, flutterwave_transaction_id, amount } =
    req.body || {};

  if (!transaction_reference && !flutterwave_transaction_id) {
    throw new ErrorClass(
      "transaction_reference or flutterwave_transaction_id is required",
      400,
    );
  }

  // Get student
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get current semester for academic year
  const currentDate = new Date();
  const today = currentDate.toISOString().split("T")[0];

  let currentSemester = await Semester.findOne({
    where: {
      [Op.and]: [
        Semester.sequelize.literal(`DATE(start_date) <= '${today}'`),
        Semester.sequelize.literal(`DATE(end_date) >= '${today}'`),
      ],
    },
    order: [["id", "DESC"]],
  });

  if (!currentSemester) {
    currentSemester = await Semester.findOne({
      where: Semester.sequelize.where(
        Semester.sequelize.fn("UPPER", Semester.sequelize.col("status")),
        "ACTIVE",
      ),
      order: [["id", "DESC"]],
    });
  }

  const academicYear = currentSemester?.academic_year?.toString() || null;

  const verificationId = flutterwave_transaction_id || transaction_reference;
  let verificationResult;

  try {
    verificationResult = await verifyTransaction(verificationId, {
      maxRetries: 8,
      retryDelayMs: 2500,
    });
  } catch (error) {
    if (error instanceof ErrorClass && error.statusCode === 404) {
      return res.status(200).json({
        success: true,
        data: {
          outcome: "pending_verification",
          message:
            "Flutterwave has not registered this payment yet. Wait a few seconds and call POST /api/wallet/fund again with the same reference. Do not show the user a failure if they were charged.",
          retry_after_seconds: 5,
        },
      });
    }
    throw new ErrorClass(`Payment verification failed: ${error.message}`, 400);
  }

  if (!verificationResult.success) {
    return res.status(400).json({
      success: false,
      data: {
        outcome: "failed",
        message:
          verificationResult.message ||
          "Could not verify payment with Flutterwave.",
        flutterwave_message: verificationResult.message,
      },
    });
  }

  const flutterwaveTransaction = verificationResult.transaction;
  const fwStatus = getTransactionStatus(flutterwaveTransaction);

  if (fwStatus === "pending") {
    return res.status(200).json({
      success: true,
      data: {
        outcome: "pending",
        message:
          "Payment is still processing at Flutterwave. Retry in a few seconds with the same reference.",
        flutterwave_status: fwStatus,
        retry_after_seconds: 5,
      },
    });
  }

  if (fwStatus === "failed" || fwStatus === "cancelled") {
    return res.status(400).json({
      success: false,
      data: {
        outcome: "failed",
        message: "Flutterwave reports this payment as failed or cancelled.",
        flutterwave_status: fwStatus,
      },
    });
  }

  if (!isTransactionSuccessful(flutterwaveTransaction)) {
    return res.status(200).json({
      success: true,
      data: {
        outcome: "pending",
        message:
          "Payment status is not successful yet. Retry shortly with the same reference.",
        flutterwave_status: fwStatus,
        retry_after_seconds: 5,
      },
    });
  }

  // Get transaction amount and currency
  const transactionAmount = getTransactionAmount(flutterwaveTransaction);
  const transactionCurrency = getTransactionCurrency(flutterwaveTransaction);

  // If amount is provided in request, verify it matches
  if (amount && Math.abs(parseFloat(amount) - transactionAmount) > 0.01) {
    throw new ErrorClass(
      `Payment amount mismatch. Expected: ${amount}, Received: ${transactionAmount}`,
      400,
    );
  }

  const txRef = getTransactionReference(flutterwaveTransaction);

  const result = await fundStudentWalletFromFlutterwave({
    studentId,
    txRef,
    flutterwaveTransactionId: flutterwaveTransaction.id?.toString(),
    amount: transactionAmount,
    currency: transactionCurrency,
    flutterwaveResponse: flutterwaveTransaction,
    academicYear,
    semester: currentSemester?.semester || null,
    today,
  });

  if (result.duplicate) {
    return res.status(200).json({
      success: true,
      message: "Wallet funding already processed",
      data: {
        outcome: "completed",
        transaction: {
          transaction_reference: txRef,
          status: "successful",
          amount: transactionAmount,
        },
        wallet: {
          balance: result.balance,
          currency: transactionCurrency,
        },
      },
    });
  }

  res.status(200).json({
    success: true,
    message: "Wallet funded successfully",
    data: {
      outcome: "completed",
      transaction: {
        transaction_reference: txRef,
        amount: transactionAmount,
        currency: transactionCurrency,
      },
      wallet: {
        previous_balance: result.previousBalance,
        new_balance: result.newBalance,
        credited: transactionAmount,
        currency: transactionCurrency,
      },
    },
  });
});

/**
 * Get student's funding transaction history
 * GET /api/wallet/transactions
 */
export const getFundingHistory = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  // Get student
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get query parameters for filtering
  const {
    page = 1,
    limit = 20,
    type, // Credit or Debit
    semester,
    academic_year,
    start_date,
    end_date,
  } = req.query;

  // Build where clause - always filter by current student
  const where = {
    student_id: studentId,
  };

  if (type) {
    where.type = type; // Filter by Credit or Debit
  }

  if (semester) {
    where.semester = semester.toString().toUpperCase();
  }

  if (academic_year) {
    where.academic_year = academic_year.toString();
  }

  // Date filtering (if dates are provided)
  if (start_date || end_date) {
    where.date = {};
    if (start_date) where.date[Op.gte] = start_date;
    if (end_date) where.date[Op.lte] = end_date;
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Get funding transactions with pagination
  const { count, rows: fundings } = await Funding.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    // Order by date DESC (most recent first), then by id DESC as tiebreaker
    order: [
      ["date", "DESC"],
      ["id", "DESC"],
    ],
  });

  res.status(200).json({
    success: true,
    message: "Funding history retrieved successfully",
    data: {
      transactions: fundings.map((funding) => ({
        id: funding.id,
        type: funding.type, // Credit or Debit
        amount: parseFloat(funding.amount) || 0,
        currency: funding.currency || student.currency || "NGN",
        service_name: funding.service_name,
        ref: funding.ref,
        date: funding.date,
        semester: funding.semester,
        academic_year: funding.academic_year,
        balance: funding.balance ? parseFloat(funding.balance) : null,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
      summary: {
        currency: student.currency || "NGN",
        total_credits:
          (await Funding.sum("amount", {
            where: {
              ...where,
              type: "Credit",
              ...fundingCurrencyWhere(student.currency),
            },
          })) || 0,
        total_debits:
          (await Funding.sum("amount", {
            where: {
              ...where,
              type: "Debit",
              ...fundingCurrencyWhere(student.currency),
            },
          })) || 0,
      },
    },
  });
});

/**
 * Get current exchange rate (USD to NGN)
 * GET /api/wallet/rate
 */
export const getExchangeRate = TryCatchFunction(async (req, res) => {
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  // Get exchange rate from system settings (USD to NGN)
  const generalSetup = await GeneralSetup.findOne({
    order: [["id", "DESC"]],
  });

  if (!generalSetup || !generalSetup.rate) {
    throw new ErrorClass("Exchange rate not configured", 404);
  }

  const exchangeRate = parseFloat(generalSetup.rate) || 1500; // Default 1500 if invalid

  res.status(200).json({
    success: true,
    message: "Exchange rate retrieved successfully",
    data: {
      exchange_rate: exchangeRate,
      from_currency: "USD",
      to_currency: "NGN",
      description: "1 USD = " + exchangeRate + " NGN",
    },
  });
});
