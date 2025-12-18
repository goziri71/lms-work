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
  const { balance: walletBalance, migrated } = await getWalletBalanceService(studentId, true);

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
  const { transaction_reference, flutterwave_transaction_id, amount } = req.body || {};

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
    throw new ErrorClass(
      `Payment verification failed: ${error.message}`,
      400
    );
  }

  if (!verificationResult.success || !isTransactionSuccessful(verificationResult.transaction)) {
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
    const { balance: currentBalance } = await getWalletBalanceService(studentId, true);

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
  const { balance: currentBalance } = await getWalletBalanceService(studentId, true);

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

