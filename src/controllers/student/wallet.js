import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { Funding } from "../../models/payment/funding.js";
import { PaymentTransaction } from "../../models/payment/paymentTransaction.js";
import { Semester } from "../../models/auth/semester.js";
import {
  verifyTransaction,
  isTransactionSuccessful,
  getTransactionAmount,
  getTransactionCurrency,
  getTransactionReference,
} from "../../services/flutterwaveService.js";
import { getWalletBalance as getWalletBalanceService } from "../../services/walletBalanceService.js";

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
    true
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
      400
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
        "ACTIVE"
      ),
      order: [["id", "DESC"]],
    });
  }

  const academicYear = currentSemester?.academic_year?.toString() || null;

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
  const existingTransaction = await PaymentTransaction.findOne({
    where: {
      [Op.or]: [
        { transaction_reference: txRef },
        { flutterwave_transaction_id: flutterwaveTransaction.id?.toString() },
      ],
      status: "successful",
    },
  });

  if (existingTransaction) {
    // Return existing transaction info
    const { balance: currentBalance } = await getWalletBalanceService(
      studentId,
      true
    );

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

  // Create payment transaction record
  const paymentTransaction = await PaymentTransaction.create({
    student_id: studentId,
    transaction_reference: txRef,
    flutterwave_transaction_id: flutterwaveTransaction.id?.toString(),
    amount: transactionAmount,
    currency: transactionCurrency,
    status: "successful",
    payment_type: "wallet_funding",
    academic_year: academicYear,
    processed_at: new Date(),
    flutterwave_response: flutterwaveTransaction,
  });

  // Get current wallet balance (with automatic migration of old balances)
  const { balance: currentBalance } = await getWalletBalanceService(
    studentId,
    true
  );

  // Credit wallet
  const newBalance = currentBalance + transactionAmount;

  const funding = await Funding.create({
    student_id: studentId,
    amount: transactionAmount,
    type: "Credit",
    service_name: "Wallet Funding",
    ref: txRef,
    date: today,
    semester: currentSemester?.semester || null,
    academic_year: academicYear,
    currency: transactionCurrency,
    balance: newBalance.toString(),
  });

  // Update student wallet_balance
  await student.update({
    wallet_balance: newBalance,
  });

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
        previous_balance: currentBalance,
        new_balance: newBalance,
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
    limit = 50,
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
            where: { ...where, type: "Credit" },
          })) || 0,
        total_debits:
          (await Funding.sum("amount", {
            where: { ...where, type: "Debit" },
          })) || 0,
      },
    },
  });
});
