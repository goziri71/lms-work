import { Op } from "sequelize";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { PaymentTransaction } from "../../../models/payment/paymentTransaction.js";
import { verifyTransaction, isTransactionSuccessful } from "../../../services/flutterwaveService.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";

/**
 * Manually verify a payment transaction
 * POST /api/admin/payments/verify
 * Super Admin Only - For verifying failed or stuck transactions
 */
export const manuallyVerifyPayment = TryCatchFunction(async (req, res) => {
  const { transaction_reference, flutterwave_transaction_id } = req.body || {};

  if (!transaction_reference && !flutterwave_transaction_id) {
    throw new ErrorClass(
      "transaction_reference or flutterwave_transaction_id is required",
      400
    );
  }

  // Find payment transaction
  const paymentTransaction = await PaymentTransaction.findOne({
    where: {
      [Op.or]: [
        { transaction_reference: transaction_reference },
        { flutterwave_transaction_id: flutterwave_transaction_id },
      ],
    },
  });

  if (!paymentTransaction) {
    throw new ErrorClass("Payment transaction not found", 404);
  }

  // Verify with Flutterwave
  const verificationId = flutterwave_transaction_id || transaction_reference;
  let verificationResult;

  try {
    verificationResult = await verifyTransaction(verificationId);
  } catch (error) {
    // Update transaction with error
    await paymentTransaction.update({
      error_message: error.message,
      verification_attempts: paymentTransaction.verification_attempts + 1,
      last_verification_at: new Date(),
    });

    throw new ErrorClass(
      `Payment verification failed: ${error.message}`,
      400
    );
  }

  const isSuccessful = verificationResult.success && 
    isTransactionSuccessful(verificationResult.transaction);

  // Update transaction
  await paymentTransaction.update({
    status: isSuccessful ? "successful" : "failed",
    flutterwave_transaction_id: verificationResult.transaction?.id?.toString() || paymentTransaction.flutterwave_transaction_id,
    verification_attempts: paymentTransaction.verification_attempts + 1,
    last_verification_at: new Date(),
    flutterwave_response: verificationResult.transaction,
    error_message: isSuccessful ? null : "Payment verification failed or payment was not successful",
  });

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "manually_verified_payment",
        "payment",
        paymentTransaction.id,
        {
          transaction_reference: paymentTransaction.transaction_reference,
          status: isSuccessful ? "successful" : "failed",
          verification_result: verificationResult,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: `Payment verification ${isSuccessful ? "successful" : "failed"}`,
    data: {
      transaction: {
        id: paymentTransaction.id,
        transaction_reference: paymentTransaction.transaction_reference,
        status: isSuccessful ? "successful" : "failed",
        amount: parseFloat(paymentTransaction.amount),
        currency: paymentTransaction.currency,
        verification_attempts: paymentTransaction.verification_attempts,
        last_verification_at: paymentTransaction.last_verification_at,
      },
      flutterwave_response: verificationResult.transaction,
    },
  });
});

/**
 * Get payment transaction details
 * GET /api/admin/payments/transactions/:id
 */
export const getPaymentTransaction = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const transaction = await PaymentTransaction.findByPk(id);

  if (!transaction) {
    throw new ErrorClass("Payment transaction not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Payment transaction retrieved successfully",
    data: {
      transaction: {
        id: transaction.id,
        student_id: transaction.student_id,
        transaction_reference: transaction.transaction_reference,
        flutterwave_transaction_id: transaction.flutterwave_transaction_id,
        amount: parseFloat(transaction.amount),
        currency: transaction.currency,
        status: transaction.status,
        payment_type: transaction.payment_type,
        academic_year: transaction.academic_year,
        verification_attempts: transaction.verification_attempts,
        last_verification_at: transaction.last_verification_at,
        error_message: transaction.error_message,
        processed_at: transaction.processed_at,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
      },
    },
  });
});

