import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CoachingBookingRequest } from "../../models/marketplace/coachingBookingRequest.js";
import { Students } from "../../models/auth/student.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import {
  assertBookingPayable,
  buildBookingTxRef,
  fulfillAcceptedBookingPayment,
  getAgreedBookingTimes,
} from "../../services/coachingBookingFulfillmentService.js";
import { attachPaymentOptions } from "../../services/bvaPaymentService.js";
import {
  verifyTransaction,
  isTransactionSuccessful,
  getTransactionAmount,
  getTransactionReference,
} from "../../services/flutterwaveService.js";

/**
 * Guards initBookingPayment/confirmBookingPayment. Access is granted if
 * EITHER the requester is logged in as the exact student who owns this
 * booking, OR they present the booking's own access_token (every booking,
 * guest or student-owned, gets one — e.g. for the "pay" link in the
 * acceptance email). What this must NOT allow: an unrelated logged-in
 * student reaching someone else's booking just because its student_id
 * happens to be null (a guest booking) — a previous version of this check
 * only verified ownership when student_id was set, which let any logged-in
 * student bypass the access_token requirement entirely for guest bookings.
 */
function assertCanActOnBooking(booking, studentId, accessToken) {
  const ownsAsStudent = studentId != null && booking.student_id === studentId;
  const hasValidToken = !!accessToken && accessToken === booking.access_token;
  if (!ownsAsStudent && !hasValidToken) {
    throw new ErrorClass(
      booking.student_id ? "Forbidden" : "Valid access_token is required",
      403
    );
  }
}

async function loadBookingByAccessToken(accessToken) {
  const booking = await CoachingBookingRequest.findOne({
    where: { access_token: accessToken },
    include: [{ model: Students, as: "student", required: false }],
  });
  if (!booking) throw new ErrorClass("Booking not found", 404);
  return booking;
}

function formatTutor(booking) {
  return booking.tutor_type === "sole_tutor"
    ? { type: "sole_tutor", id: booking.tutor_id }
    : { type: "organization", id: booking.tutor_id };
}

async function enrichTutor(tutorMeta) {
  if (tutorMeta.type === "sole_tutor") {
    const t = await SoleTutor.findByPk(tutorMeta.id, {
      attributes: ["id", "fname", "lname", "email", "phone"],
    });
    return t
      ? {
          id: t.id,
          name: `${t.fname || ""} ${t.lname || ""}`.trim(),
          email: t.email,
          phone: t.phone,
          type: "sole_tutor",
        }
      : null;
  }
  const o = await Organization.findByPk(tutorMeta.id, {
    attributes: ["id", "name", "email", "phone"],
  });
  return o
    ? { id: o.id, name: o.name, email: o.email, phone: o.phone, type: "organization" }
    : null;
}

function serializePublicBooking(booking, tutor) {
  const { startTime, endTime, durationMinutes } = getAgreedBookingTimes(booking);
  const paid = !!booking.session_id;
  const canPay = booking.status === "accepted" && !paid;

  let payment = null;
  if (canPay && parseFloat(booking.final_price || 0) > 0) {
    const txRef = booking.transaction_ref || buildBookingTxRef(booking.id);
    payment = attachPaymentOptions(
      {
        provider: "flutterwave",
        tx_ref: txRef,
        amount: parseFloat(booking.final_price).toFixed(2),
        currency: (booking.currency || "NGN").toUpperCase(),
        public_key: process.env.FLUTTERWAVE_PUBLIC_KEY?.trim() || null,
        meta: {
          type: "coaching_booking",
          booking_id: booking.id,
        },
      },
      { source: "coaching_booking", order_id: booking.id }
    );
    if (payment?.methods) {
      payment.methods = payment.methods.map((m) =>
        m.id === "bva"
          ? {
              ...m,
              source: "coaching_booking",
              booking_id: booking.id,
              access_token: booking.access_token,
            }
          : m
      );
    }
  }

  return {
    id: booking.id,
    status: booking.status,
    topic: booking.topic,
    description: booking.description,
    final_price: booking.final_price ? parseFloat(booking.final_price) : null,
    currency: booking.currency,
    agreed_start_time: startTime,
    agreed_end_time: endTime,
    duration_minutes: durationMinutes,
    payment_due_at: booking.expires_at,
    paid,
    can_pay: canPay,
    session_id: booking.session_id,
    tutor,
    is_guest: !booking.student_id,
    payment,
  };
}

/**
 * GET /api/marketplace/coaching/bookings/access/:accessToken
 */
export const getPublicBookingByAccessToken = TryCatchFunction(async (req, res) => {
  const booking = await loadBookingByAccessToken(req.params.accessToken);
  const tutor = await enrichTutor(formatTutor(booking));

  res.json({
    success: true,
    data: serializePublicBooking(booking, tutor),
  });
});

/**
 * POST /api/marketplace/coaching/bookings/:id/init-payment
 * Body: { access_token } for guests; students may use JWT instead.
 */
export const initBookingPayment = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { access_token: accessToken } = req.body || {};

  let booking = await CoachingBookingRequest.findByPk(id, {
    include: [{ model: Students, as: "student", required: false }],
  });
  if (!booking) throw new ErrorClass("Booking not found", 404);

  const studentId =
    req.user?.userType === "student" ? req.user.id : null;
  assertCanActOnBooking(booking, studentId, accessToken);

  await assertBookingPayable(booking);

  const txRef = booking.transaction_ref || buildBookingTxRef(booking.id);
  if (!booking.transaction_ref) {
    await booking.update({ transaction_ref: txRef });
  }

  const payment = attachPaymentOptions(
    {
      provider: "flutterwave",
      tx_ref: txRef,
      amount: parseFloat(booking.final_price).toFixed(2),
      currency: (booking.currency || "NGN").toUpperCase(),
      public_key: process.env.FLUTTERWAVE_PUBLIC_KEY?.trim() || null,
      meta: {
        type: "coaching_booking",
        booking_id: booking.id,
      },
    },
    { source: "coaching_booking", order_id: booking.id }
  );

  if (payment?.methods) {
    payment.methods = payment.methods.map((m) =>
      m.id === "bva"
        ? {
            ...m,
            source: "coaching_booking",
            booking_id: booking.id,
            access_token: booking.access_token,
          }
        : m
    );
  }

  res.status(200).json({
    success: true,
    data: {
      booking_id: booking.id,
      access_token: booking.access_token,
      payment,
    },
  });
});

/**
 * POST /api/marketplace/coaching/bookings/:id/confirm-payment
 */
export const confirmBookingPayment = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const {
    access_token: accessToken,
    transaction_reference,
    flutterwave_transaction_id,
  } = req.body || {};

  let booking = await CoachingBookingRequest.findByPk(id);
  if (!booking) throw new ErrorClass("Booking not found", 404);
  if (booking.session_id) {
    return res.status(200).json({
      success: true,
      message: "Already paid",
      data: { session_id: booking.session_id },
    });
  }

  const studentId =
    req.user?.userType === "student" ? req.user.id : null;
  assertCanActOnBooking(booking, studentId, accessToken);

  // transaction_ref must already be set by init-payment (server-generated,
  // not client-controlled) — this is what the tx_ref match check below
  // binds to. Without requiring it up front, a caller could skip
  // init-payment and supply any transaction reference with nothing on
  // record yet to validate it against.
  if (!booking.transaction_ref) {
    throw new ErrorClass(
      "Call init-payment for this booking before confirming payment",
      400
    );
  }

  const verifyId =
    flutterwave_transaction_id || transaction_reference || booking.transaction_ref;

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

  const txRef = getTransactionReference(fw) || booking.transaction_ref;

  // The verified transaction must actually be the one that was initiated
  // for THIS booking — without this, any real successful transaction of a
  // matching amount (the only other check fulfillAcceptedBookingPayment
  // applies) could be reused to "pay" for an unrelated booking. Mirrors
  // the equivalent check already done correctly in
  // marketplaceGuestCheckoutService.js's confirmGuestOrderFlutterwave.
  if (booking.transaction_ref && txRef && txRef !== booking.transaction_ref) {
    throw new ErrorClass("Transaction reference does not match this booking", 400);
  }

  const result = await fulfillAcceptedBookingPayment(booking.id, {
    paymentMethod: "flutterwave",
    txRef,
    paidAmount: getTransactionAmount(fw),
    payerStudentId: studentId || booking.student_id,
  });

  res.status(201).json({
    success: true,
    message: "Payment confirmed. Meeting details sent by email.",
    data: {
      session_id: result.session.id,
      view_link: result.view_link,
      access_token: booking.access_token,
    },
  });
});
