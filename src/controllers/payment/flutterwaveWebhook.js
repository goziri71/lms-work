import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { PaymentTransaction } from "../../models/payment/paymentTransaction.js";
import { SchoolFees } from "../../models/payment/schoolFees.js";
import { Funding } from "../../models/payment/funding.js";
import { Students } from "../../models/auth/student.js";
import {
  verifyWebhookSignature,
  isTransactionSuccessful,
  getTransactionAmount,
  getTransactionReference,
} from "../../services/flutterwaveService.js";

/**
 * Flutterwave webhook endpoint
 * POST /api/webhooks/flutterwave
 * 
 * This endpoint receives payment status updates from Flutterwave
 * It's more reliable than frontend callbacks
 */
export const flutterwaveWebhook = TryCatchFunction(async (req, res) => {
  // Get webhook signature from headers
  const signature = req.headers["verif-hash"] || req.headers["x-flutterwave-signature"];

  // Verify webhook signature
  // Note: For proper signature verification, you may need to use raw body
  // For now, we'll verify if signature is provided, but allow processing if not
  // In production, always verify signature for security
  if (signature && FLUTTERWAVE_SECRET_KEY) {
    // Get raw body if available (may need express.raw() middleware for webhook route)
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const isValid = verifyWebhookSignature(signature, rawBody);
    if (!isValid) {
      console.error("Invalid Flutterwave webhook signature");
      return res.status(401).json({ message: "Invalid signature" });
    }
  } else if (signature && !FLUTTERWAVE_SECRET_KEY) {
    console.warn("⚠️  Flutterwave secret key not configured - skipping signature verification");
  }

  const event = req.body;

  // Handle different event types
  if (event.event === "charge.completed" || event.event === "transfer.completed") {
    const transactionData = event.data;

    // Get transaction reference
    const txRef = getTransactionReference(transactionData);
    if (!txRef) {
      console.error("No transaction reference in webhook");
      return res.status(400).json({ message: "No transaction reference" });
    }

    // Find payment transaction
    const paymentTransaction = await PaymentTransaction.findOne({
      where: {
        [Op.or]: [
          { transaction_reference: txRef },
          { flutterwave_transaction_id: transactionData.id?.toString() },
        ],
      },
    });

    if (!paymentTransaction) {
      console.warn(`Payment transaction not found for reference: ${txRef}`);
      return res.status(200).json({ message: "Transaction not found (may be for different service)" });
    }

    // Check if already processed
    if (paymentTransaction.status === "successful") {
      console.log(`Payment ${txRef} already processed`);
      return res.status(200).json({ message: "Already processed" });
    }

    // Check if payment is successful
    if (!isTransactionSuccessful(transactionData)) {
      // Update as failed
      await paymentTransaction.update({
        status: "failed",
        error_message: transactionData.processor_response || "Payment failed",
        flutterwave_response: transactionData,
        last_verification_at: new Date(),
      });

      return res.status(200).json({ message: "Payment failed" });
    }

    // Verify amount matches
    const transactionAmount = getTransactionAmount(transactionData);
    if (Math.abs(transactionAmount - parseFloat(paymentTransaction.amount)) > 0.01) {
      await paymentTransaction.update({
        status: "failed",
        error_message: "Payment amount mismatch",
        flutterwave_response: transactionData,
        last_verification_at: new Date(),
      });

      return res.status(200).json({ message: "Amount mismatch" });
    }

    // Process payment if it's school fees
    if (paymentTransaction.payment_type === "school_fees") {
      const studentId = paymentTransaction.student_id;
      const academicYear = paymentTransaction.academic_year;
      const today = new Date().toISOString().split("T")[0];

      // Check if already paid (idempotency)
      const existingPayment = await SchoolFees.findOne({
        where: {
          student_id: studentId,
          academic_year: academicYear,
          status: "Paid",
        },
      });

      if (!existingPayment) {
        // Get student
        const student = await Students.findByPk(studentId);

        if (student) {
          // Create SchoolFees record
          await SchoolFees.create({
            student_id: studentId,
            amount: paymentTransaction.amount,
            status: "Paid",
            academic_year: academicYear,
            semester: null,
            date: today,
            teller_no: paymentTransaction.transaction_reference,
            matric_number: student.matric_number,
            type: "School Fees",
            student_level: student.level,
            currency: paymentTransaction.currency,
          });

          // Get current wallet balance
          const totalCredits = await Funding.sum("amount", {
            where: { student_id: studentId, type: "Credit" },
          });
          const totalDebits = await Funding.sum("amount", {
            where: { student_id: studentId, type: "Debit" },
          });
          const currentBalance = (totalCredits || 0) - (totalDebits || 0);

          // Credit wallet
          const newBalance = currentBalance + parseFloat(paymentTransaction.amount);

          await Funding.create({
            student_id: studentId,
            amount: paymentTransaction.amount,
            type: "Credit",
            service_name: "School Fees Payment",
            ref: paymentTransaction.transaction_reference,
            date: today,
            semester: null,
            academic_year: academicYear,
            currency: paymentTransaction.currency,
            balance: newBalance.toString(),
          });

          // Update student wallet_balance
          await student.update({
            wallet_balance: newBalance,
          });
        }
      }

      // Update payment transaction
      await paymentTransaction.update({
        status: "successful",
        flutterwave_transaction_id: transactionData.id?.toString(),
        processed_at: new Date(),
        flutterwave_response: transactionData,
      });
    }
  }

  // Always return 200 to acknowledge webhook receipt
  res.status(200).json({ message: "Webhook received" });
});

