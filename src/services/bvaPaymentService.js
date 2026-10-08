import { ErrorClass } from "../utils/errorClass/index.js";
import { createOneTimeVirtualAccount } from "./flutterwaveService.js";
import { MarketplaceGuestOrder } from "../models/marketplace/marketplaceGuestOrder.js";
import { EventTicketOrder } from "../models/marketplace/eventTicketOrder.js";
import { PaymentTransaction } from "../models/payment/paymentTransaction.js";
import { Courses } from "../models/course/courses.js";
import { CourseReg } from "../models/course_reg.js";
import { CoachingSession } from "../models/marketplace/coachingSession.js";
import { CoachingBookingRequest } from "../models/marketplace/coachingBookingRequest.js";
import {
  assertBookingPayable,
  buildBookingTxRef,
  fulfillAcceptedBookingPayment,
} from "./coachingBookingFulfillmentService.js";
import { CoachingSessionPurchase } from "../models/marketplace/coachingSessionPurchase.js";
import { Students } from "../models/auth/student.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";
import { WspCommission } from "../models/marketplace/wspCommission.js";
import { processMarketplacePurchase } from "./revenueSharingService.js";
import { getCourseSalePricing } from "../utils/coursePricing.js";
import { applyLegacyWalletMirror } from "../utils/tutorWallet.js";
import { db } from "../database/database.js";

export function attachPaymentOptions(paymentPayload, { endpoint, source, order_id } = {}) {
  if (!paymentPayload) return paymentPayload;
  return {
    ...paymentPayload,
    methods: [
      {
        id: "flutterwave_inline",
        label: "Card / Flutterwave",
        available: true,
      },
      {
        id: "bva",
        label: "Bank transfer (one-time virtual account)",
        available: String(paymentPayload.currency || "NGN").toUpperCase() === "NGN",
        endpoint: endpoint || "/api/marketplace/payments/bva",
        source: source || null,
        order_id: order_id || paymentPayload.meta?.order_id || null,
        currency: "NGN",
      },
    ],
  };
}

export async function createBvaForTx({
  txRef,
  amount,
  currency,
  email,
  phone,
  name,
  narration,
  meta,
}) {
  return createOneTimeVirtualAccount({
    txRef,
    amount,
    currency,
    email,
    phoneNumber: phone,
    fullname: name,
    narration,
    meta,
  });
}

export async function createBvaForGuestOrder(orderId) {
  const order = await MarketplaceGuestOrder.findByPk(orderId);
  if (!order) throw new ErrorClass("Order not found", 404);
  if (order.status === "paid") throw new ErrorClass("Order already paid", 400);
  if (order.status !== "pending") {
    throw new ErrorClass(`Order cannot be paid (status: ${order.status})`, 400);
  }
  if (!order.transaction_ref) {
    throw new ErrorClass("Order has no payment reference", 400);
  }
  return createBvaForTx({
    txRef: order.transaction_ref,
    amount: order.total_amount,
    currency: order.currency,
    email: order.buyer_email,
    phone: order.buyer_phone,
    name: order.buyer_name,
    narration: `Digital product ${order.product_title || order.id}`,
    meta: {
      type: "marketplace_guest",
      order_id: String(order.id),
      product_type: order.product_type,
      product_id: String(order.product_id),
    },
  });
}

export async function createBvaForEventOrder(orderId) {
  const order = await EventTicketOrder.findByPk(orderId);
  if (!order) throw new ErrorClass("Order not found", 404);
  if (order.status === "paid") throw new ErrorClass("Order already paid", 400);
  if (!["pending", "pending_approval"].includes(order.status)) {
    throw new ErrorClass(`Order cannot be paid (status: ${order.status})`, 400);
  }
  if (!order.transaction_ref) {
    throw new ErrorClass("Order has no payment reference", 400);
  }
  return createBvaForTx({
    txRef: order.transaction_ref,
    amount: order.total_amount,
    currency: order.currency,
    email: order.buyer_email,
    phone: order.buyer_phone,
    name: order.buyer_name,
    narration: `Event tickets order ${order.id}`,
    meta: {
      type: "event_ticket",
      order_id: String(order.id),
      event_id: String(order.event_id),
    },
  });
}

export async function createBvaForWalletFund(student, amount) {
  const amt = parseFloat(amount);
  if (Number.isNaN(amt) || amt <= 0) {
    throw new ErrorClass("A positive amount is required", 400);
  }
  const txRef = `WALLET-BVA-${student.id}-${Date.now()}`;
  const bva = await createBvaForTx({
    txRef,
    amount: amt,
    currency: student.currency || "NGN",
    email: student.email,
    phone: student.phone,
    name: `${student.fname || ""} ${student.lname || ""}`.trim(),
    narration: `Wallet fund student ${student.id}`,
    meta: {
      type: "wallet_fund",
      student_id: String(student.id),
    },
  });
  return { ...bva, tx_ref: txRef };
}

export async function createBvaForCoursePurchase(student, courseId) {
  const course = await Courses.findByPk(courseId);
  if (!course || !course.is_marketplace || course.marketplace_status !== "published") {
    throw new ErrorClass("Course not found or not available", 404);
  }

  const existing = await CourseReg.findOne({
    where: {
      student_id: student.id,
      course_id: courseId,
      registration_status: "marketplace_purchased",
    },
  });
  if (existing) throw new ErrorClass("You already own this course", 400);

  const pricing = getCourseSalePricing(course);
  const amount = parseFloat(pricing.sale_price);
  if (amount <= 0) {
    throw new ErrorClass("This course is free. Use the purchase endpoint instead.", 400);
  }
  if ((course.currency || "NGN").toUpperCase() !== "NGN") {
    throw new ErrorClass("One-time bank transfer is only available for NGN-priced courses", 400);
  }

  const txRef = `COURSE-BVA-${courseId}-${student.id}-${Date.now()}`;
  await PaymentTransaction.create({
    student_id: student.id,
    transaction_reference: txRef,
    amount,
    currency: "NGN",
    status: "pending",
    payment_type: "course_purchase",
    course_id: courseId,
  });

  const bva = await createBvaForTx({
    txRef,
    amount,
    currency: "NGN",
    email: student.email,
    phone: student.phone,
    name: `${student.fname || ""} ${student.lname || ""}`.trim(),
    narration: `Course ${course.title}`,
    meta: {
      type: "course_purchase",
      student_id: String(student.id),
      course_id: String(courseId),
    },
  });
  return { ...bva, course_id: courseId };
}

export async function createBvaForCoachingSession(student, sessionId) {
  const session = await CoachingSession.findByPk(sessionId);
  if (!session) throw new ErrorClass("Coaching session not found", 404);
  if (session.pricing_type !== "paid") {
    throw new ErrorClass("This session is free. No payment required.", 400);
  }
  const existing = await CoachingSessionPurchase.findOne({
    where: { session_id: sessionId, student_id: student.id },
  });
  if (existing) throw new ErrorClass("You already purchased this session", 400);

  const amount = parseFloat(session.price || 0);
  if (amount <= 0) throw new ErrorClass("Invalid session price", 400);
  if ((session.currency || "NGN").toUpperCase() !== "NGN") {
    throw new ErrorClass("One-time bank transfer is only available for NGN-priced sessions", 400);
  }

  const txRef = `COACH-BVA-${sessionId}-${student.id}-${Date.now()}`;
  await PaymentTransaction.create({
    student_id: student.id,
    transaction_reference: txRef,
    amount,
    currency: "NGN",
    status: "pending",
    payment_type: "coaching_session",
  });

  const bva = await createBvaForTx({
    txRef,
    amount,
    currency: "NGN",
    email: student.email,
    phone: student.phone,
    name: `${student.fname || ""} ${student.lname || ""}`.trim(),
    narration: `Coaching ${session.title}`,
    meta: {
      type: "coaching_session",
      student_id: String(student.id),
      session_id: String(sessionId),
    },
  });
  return { ...bva, session_id: sessionId };
}

export async function createBvaForCoachingBooking(
  bookingId,
  { accessToken, payerStudentId } = {}
) {
  const booking = await CoachingBookingRequest.findByPk(bookingId, {
    include: [{ model: Students, as: "student", required: false }],
  });
  if (!booking) throw new ErrorClass("Booking not found", 404);
  if (payerStudentId) {
    if (booking.student_id && booking.student_id !== payerStudentId) {
      throw new ErrorClass("Forbidden", 403);
    }
  } else if (!accessToken || accessToken !== booking.access_token) {
    throw new ErrorClass("Valid access_token is required", 403);
  }
  await assertBookingPayable(booking);

  const amount = parseFloat(booking.final_price || 0);
  if (amount <= 0) throw new ErrorClass("Invalid booking price", 400);
  if ((booking.currency || "NGN").toUpperCase() !== "NGN") {
    throw new ErrorClass(
      "One-time bank transfer is only available for NGN-priced bookings",
      400
    );
  }

  const txRef = booking.transaction_ref || buildBookingTxRef(bookingId);
  if (!booking.transaction_ref) {
    await booking.update({ transaction_ref: txRef });
  }

  const email =
    booking.guest_email ||
    booking.student?.email ||
    "buyer@example.com";
  const name =
    booking.guest_name ||
    (booking.student
      ? `${booking.student.fname || ""} ${booking.student.lname || ""}`.trim()
      : "Guest");

  const bva = await createBvaForTx({
    txRef,
    amount,
    currency: "NGN",
    email,
    phone: booking.guest_phone || booking.student?.phone,
    name,
    narration: `Coaching booking ${booking.topic}`,
    meta: {
      type: "coaching_booking",
      booking_id: String(bookingId),
    },
  });
  return { ...bva, booking_id: bookingId };
}

export async function fulfillCoachingBookingFromPayment(txRef, transactionData = {}) {
  const booking = await CoachingBookingRequest.findOne({
    where: { transaction_ref: txRef },
  });
  if (!booking) return { handled: false };
  if (booking.session_id) return { handled: true, alreadyPaid: true };

  const { isTransactionSuccessful, getTransactionAmount, getTransactionCurrency } =
    await import("./flutterwaveService.js");
  if (!isTransactionSuccessful(transactionData)) {
    return { handled: false };
  }

  await fulfillAcceptedBookingPayment(booking.id, {
    paymentMethod: "flutterwave_bva",
    txRef,
    paidAmount: getTransactionAmount(transactionData),
    paidCurrency: getTransactionCurrency(transactionData),
    payerStudentId: booking.student_id,
  });
  return { handled: true, alreadyPaid: false };
}

export async function fulfillCoursePurchaseFromPayment(txRef, transactionData = {}) {
  const payment = await PaymentTransaction.findOne({
    where: { transaction_reference: txRef, payment_type: "course_purchase" },
  });
  if (!payment) return { handled: false };
  if (payment.status === "successful") return { handled: true, alreadyPaid: true };

  const studentId = payment.student_id;
  const courseId = payment.course_id;
  const already = await CourseReg.findOne({
    where: {
      student_id: studentId,
      course_id: courseId,
      registration_status: "marketplace_purchased",
    },
  });
  if (!already) {
    await processMarketplacePurchase({
      course_id: courseId,
      student_id: studentId,
      payment_reference: txRef,
      payment_method: "flutterwave_bva",
    });
    await CourseReg.create({
      student_id: studentId,
      course_id: courseId,
      academic_year: null,
      semester: null,
      date: new Date().toISOString().split("T")[0],
      registration_status: "marketplace_purchased",
      course_reg_id: null,
      program_id: null,
      facaulty_id: null,
      level: null,
      first_ca: 0,
      second_ca: 0,
      third_ca: 0,
      exam_score: 0,
    });
  }

  await payment.update({
    status: "successful",
    flutterwave_transaction_id: transactionData.id?.toString() || payment.flutterwave_transaction_id,
    processed_at: new Date(),
    flutterwave_response: transactionData || payment.flutterwave_response,
  });
  return { handled: true, alreadyPaid: !!already };
}

export async function fulfillCoachingPurchaseFromPayment(txRef, transactionData = {}) {
  const payment = await PaymentTransaction.findOne({
    where: { transaction_reference: txRef, payment_type: "coaching_session" },
  });
  if (!payment) return { handled: false };
  if (payment.status === "successful") return { handled: true, alreadyPaid: true };

  const meta = transactionData.meta || {};
  const fromRef = String(txRef).match(/^COACH-BVA-(\d+)-/);
  const sessionId = parseInt(meta.session_id || fromRef?.[1], 10);
  if (!sessionId) return { handled: false };

  const existing = await CoachingSessionPurchase.findOne({
    where: { session_id: sessionId, student_id: payment.student_id },
  });
  if (existing) {
    await payment.update({ status: "successful", processed_at: new Date() });
    return { handled: true, alreadyPaid: true };
  }

  const session = await CoachingSession.findByPk(sessionId);
  if (!session) return { handled: false };

  const amount = parseFloat(payment.amount);
  const commissionRate = parseFloat(session.commission_rate || 15);
  const wspCommission = (amount * commissionRate) / 100;
  const tutorEarnings = amount - wspCommission;

  const t = await db.transaction();
  try {
    const purchase = await CoachingSessionPurchase.create(
      {
        session_id: sessionId,
        student_id: payment.student_id,
        price_paid: amount,
        currency: payment.currency,
        commission_rate: commissionRate,
        wsp_commission: wspCommission,
        tutor_earnings: tutorEarnings,
        transaction_ref: txRef,
        payment_method: "flutterwave_bva",
      },
      { transaction: t }
    );

    if (wspCommission > 0) {
      await WspCommission.create(
        {
          transaction_id: purchase.id,
          amount: wspCommission,
          currency: payment.currency,
          status: "collected",
          collected_at: new Date(),
        },
        { transaction: t }
      );
    }

    if (session.tutor_type === "sole_tutor" || session.tutor_type === "organization") {
      const OwnerModel =
        session.tutor_type === "sole_tutor" ? SoleTutor : Organization;
      const owner = await OwnerModel.findByPk(session.tutor_id, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (owner) {
        const nextPrimary = parseFloat(owner.wallet_balance_primary || 0) + tutorEarnings;
        const updates = {
          wallet_balance_primary: nextPrimary,
          total_earnings: parseFloat(owner.total_earnings || 0) + tutorEarnings,
        };
        applyLegacyWalletMirror(updates, nextPrimary);
        await owner.update(updates, { transaction: t });
      }
    }

    try {
      const { CoachingParticipant } = await import(
        "../models/marketplace/coachingParticipant.js"
      );
      const existingParticipant = await CoachingParticipant.findOne({
        where: { session_id: sessionId, student_id: payment.student_id },
        transaction: t,
      });
      if (!existingParticipant) {
        await CoachingParticipant.create(
          { session_id: sessionId, student_id: payment.student_id },
          { transaction: t }
        );
      }
    } catch {
      /* optional */
    }

    await payment.update(
      {
        status: "successful",
        flutterwave_transaction_id: transactionData.id?.toString() || null,
        processed_at: new Date(),
      },
      { transaction: t }
    );
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  return { handled: true, alreadyPaid: false };
}
