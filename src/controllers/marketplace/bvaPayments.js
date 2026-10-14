import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import {
  createBvaForGuestOrder,
  createBvaForEventOrder,
  createBvaForWalletFund,
  createBvaForCoursePurchase,
  createBvaForCoachingSession,
  createBvaForCoachingBooking,
  fulfillCoursePurchaseFromPayment,
  fulfillCoachingPurchaseFromPayment,
  fulfillCoachingBookingFromPayment,
} from "../../services/bvaPaymentService.js";
import {
  verifyTransaction,
  isTransactionSuccessful,
  getTransactionReference,
} from "../../services/flutterwaveService.js";

export const initiateBvaPayment = TryCatchFunction(async (req, res) => {
  const { source, order_id, course_id, session_id, booking_id, access_token, amount } =
    req.body || {};
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
  } else if (source === "coaching_booking") {
    if (!booking_id) throw new ErrorClass("booking_id is required", 400);
    if (req.user?.userType !== "student" && !access_token) {
      throw new ErrorClass(
        "access_token is required for guest booking payment",
        400
      );
    }
    bva = await createBvaForCoachingBooking(parseInt(booking_id, 10), {
      accessToken: access_token,
      payerStudentId:
        req.user?.userType === "student" ? req.user.id : null,
    });
  } else {
    throw new ErrorClass(
      "source must be guest_order, event_order, wallet, course, coaching_session, or coaching_booking",
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

  // Bank transfers can genuinely take minutes to post on Flutterwave's side
  // (their own docs say so), but this is a synchronous HTTP request — the
  // previous maxRetries:12 / 5000ms (up to 60s) held the connection open
  // long enough to blow past typical client/proxy timeouts, which is what
  // showed up as a frontend "network error" while the server kept retrying
  // in the background with nobody left to receive the response. Keep this
  // check short, and if the transfer hasn't posted yet, say so clearly
  // instead of erroring — the webhook (flutterwaveWebhook.js) still
  // fulfills the booking/order asynchronously the moment Flutterwave does
  // detect it, independent of whether this request is still open.
  const verification = await verifyTransaction(String(verifyId), {
    maxRetries: 3,
    retryDelayMs: 2000,
  });
  if (!verification.success || !verification.transaction) {
    return res.status(202).json({
      success: true,
      pending: true,
      message:
        "We haven't seen your bank transfer post yet. This can take a few minutes — " +
        "we'll complete your payment automatically as soon as it arrives, or you can " +
        "check back and confirm again shortly.",
      data: { source },
    });
  }
  const fw = verification.transaction;
  if (!isTransactionSuccessful(fw)) {
    return res.status(202).json({
      success: true,
      pending: true,
      message: "Your transfer was found but hasn't been confirmed successful yet. Please check back shortly.",
      data: { source },
    });
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

  if (source === "coaching_booking") {
    const result = await fulfillCoachingBookingFromPayment(txRef, fw);
    if (!result.handled) throw new ErrorClass("Booking payment not found", 404);
    return res.status(200).json({
      success: true,
      message: result.alreadyPaid ? "Already paid" : "Booking confirmed",
      data: { source, tx_ref: txRef },
    });
  }

  throw new ErrorClass(
    "Use the order confirm-payment or wallet/fund endpoint for this source",
    400
  );
});
