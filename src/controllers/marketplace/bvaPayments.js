import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import {
  createBvaForGuestOrder,
  createBvaForEventOrder,
  createBvaForWalletFund,
  createBvaForCoursePurchase,
  createBvaForCoachingSession,
  fulfillCoursePurchaseFromPayment,
  fulfillCoachingPurchaseFromPayment,
} from "../../services/bvaPaymentService.js";
import {
  verifyTransaction,
  isTransactionSuccessful,
  getTransactionReference,
} from "../../services/flutterwaveService.js";

export const initiateBvaPayment = TryCatchFunction(async (req, res) => {
  const { source, order_id, course_id, session_id, amount } = req.body || {};
  if (!source) throw new ErrorClass("source is required", 400);

  let bva;

  if (source === "guest_order") {
    if (!order_id) throw new ErrorClass("order_id is required", 400);
    bva = await createBvaForGuestOrder(parseInt(order_id, 10));
  } else if (source === "event_order") {
    if (!order_id) throw new ErrorClass("order_id is required", 400);
    bva = await createBvaForEventOrder(parseInt(order_id, 10));
  } else if (source === "wallet") {
    if (req.user?.userType !== "student") {
      throw new ErrorClass("Only students can fund wallet with BVA", 403);
    }
    const student = await Students.findByPk(req.user.id);
    if (!student) throw new ErrorClass("Student not found", 404);
    bva = await createBvaForWalletFund(student, amount);
  } else if (source === "course") {
    if (req.user?.userType !== "student") {
      throw new ErrorClass("Only students can buy courses", 403);
    }
    const student = await Students.findByPk(req.user.id);
    if (!student) throw new ErrorClass("Student not found", 404);
    bva = await createBvaForCoursePurchase(student, parseInt(course_id, 10));
  } else if (source === "coaching_session") {
    if (req.user?.userType !== "student") {
      throw new ErrorClass("Only students can buy coaching sessions", 403);
    }
    const student = await Students.findByPk(req.user.id);
    if (!student) throw new ErrorClass("Student not found", 404);
    bva = await createBvaForCoachingSession(student, parseInt(session_id, 10));
  } else {
    throw new ErrorClass(
      "source must be guest_order, event_order, wallet, course, or coaching_session",
      400
    );
  }

  res.status(201).json({
    success: true,
    message: "Transfer to this account to complete payment",
    data: {
      payment_method: "bva",
      ...bva,
    },
  });
});

export const confirmBvaPayment = TryCatchFunction(async (req, res) => {
  const { source, transaction_reference, flutterwave_transaction_id } =
    req.body || {};
  if (!source) throw new ErrorClass("source is required", 400);
  const verifyId = flutterwave_transaction_id || transaction_reference;
  if (!verifyId) {
    throw new ErrorClass("transaction_reference is required", 400);
  }

  const verification = await verifyTransaction(String(verifyId), {
    maxRetries: 3,
    retryDelayMs: 1500,
  });
  if (!verification.success || !verification.transaction) {
    throw new ErrorClass(verification.message || "Payment verification failed", 400);
  }
  const fw = verification.transaction;
  if (!isTransactionSuccessful(fw)) {
    throw new ErrorClass("Payment was not successful yet", 400);
  }
  const txRef = getTransactionReference(fw) || transaction_reference;

  if (source === "course") {
    const result = await fulfillCoursePurchaseFromPayment(txRef, fw);
    if (!result.handled) throw new ErrorClass("Course payment not found", 404);
    return res.status(200).json({
      success: true,
      message: result.alreadyPaid ? "Already enrolled" : "Course enrolled",
      data: { source, tx_ref: txRef },
    });
  }

  if (source === "coaching_session") {
    const result = await fulfillCoachingPurchaseFromPayment(txRef, fw);
    if (!result.handled) throw new ErrorClass("Coaching payment not found", 404);
    return res.status(200).json({
      success: true,
      message: result.alreadyPaid ? "Already purchased" : "Session access granted",
      data: { source, tx_ref: txRef },
    });
  }

  throw new ErrorClass(
    "Use the order confirm-payment or wallet/fund endpoint for this source",
    400
  );
});
