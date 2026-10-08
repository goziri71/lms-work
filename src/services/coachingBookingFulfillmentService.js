import crypto from "crypto";
import { Op, Transaction } from "sequelize";
import { ErrorClass } from "../utils/errorClass/index.js";
import { CoachingBookingRequest } from "../models/marketplace/coachingBookingRequest.js";
import { CoachingSession } from "../models/marketplace/coachingSession.js";
import { CoachingSessionPurchase } from "../models/marketplace/coachingSessionPurchase.js";
import { CoachingParticipant } from "../models/marketplace/coachingParticipant.js";
import { TutorCoachingProfile } from "../models/marketplace/tutorCoachingProfile.js";
import { Students } from "../models/auth/student.js";
import { Funding } from "../models/payment/funding.js";
import { GeneralSetup } from "../models/settings/generalSetup.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";
import { TutorWalletTransaction } from "../models/marketplace/tutorWalletTransaction.js";
import { WspCommission } from "../models/marketplace/wspCommission.js";
import { calculateWalletBalanceFromFunding } from "./walletBalanceService.js";
import {
  streamVideoService,
  formatStreamUserId,
} from "../service/streamVideoService.js";
import { checkAndDeductHours } from "../controllers/marketplace/coachingHours.js";
import { Config } from "../config/config.js";
import { db } from "../database/database.js";
import { applyLegacyWalletMirror } from "../utils/tutorWallet.js";
import { joinFrontendUrl } from "../utils/frontendUrl.js";
import { emailService } from "./emailService.js";
import { generateGuestAccessToken } from "./marketplaceGuestCheckoutService.js";

export const ACCEPTED_PAYMENT_WINDOW_MS = 30 * 60 * 1000;

export function buildBookingTxRef(bookingId) {
  return `COACHING-BOOKING-${bookingId}-${Date.now()}`;
}

export function buildBookingPayUrl(accessToken) {
  return joinFrontendUrl(
    process.env.FRONTEND_URL || Config.frontendUrl,
    `coaching/bookings/${accessToken}`
  );
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function getBookingBuyerEmail(booking) {
  if (booking.student_id) {
    return booking.student?.email || booking.guest_email;
  }
  return booking.guest_email;
}

export function getAgreedBookingTimes(booking) {
  const isCounterAccepted = booking.accepted_by === "student";
  return {
    startTime: new Date(
      isCounterAccepted
        ? booking.counter_proposed_start_time
        : booking.proposed_start_time
    ),
    endTime: new Date(
      isCounterAccepted
        ? booking.counter_proposed_end_time
        : booking.proposed_end_time
    ),
    durationMinutes: isCounterAccepted
      ? booking.counter_proposed_duration_minutes
      : booking.proposed_duration_minutes,
  };
}

export async function assertBookingPayable(booking) {
  if (!booking) throw new ErrorClass("Booking not found", 404);
  if (booking.status !== "accepted") {
    throw new ErrorClass(
      "Booking is not ready for payment. Wait for tutor acceptance.",
      400
    );
  }
  if (booking.session_id) {
    throw new ErrorClass("This booking has already been paid", 400);
  }
  if (booking.expires_at && new Date(booking.expires_at) < new Date()) {
    booking.status = "expired";
    await booking.save();
    throw new ErrorClass(
      "The payment window for this booking has expired.",
      410
    );
  }
  const { startTime } = getAgreedBookingTimes(booking);
  if (startTime <= new Date()) {
    throw new ErrorClass(
      "The agreed session time has already passed.",
      400
    );
  }
}

export async function sendBookingAcceptedPaymentEmail(booking) {
  const token = booking.access_token || generateGuestAccessToken();
  if (!booking.access_token) {
    await booking.update({ access_token: token });
  }

  const email =
    normalizeEmail(booking.guest_email) ||
    normalizeEmail(booking.student?.email);
  const name =
    booking.guest_name ||
    (booking.student
      ? `${booking.student.fname || ""} ${booking.student.lname || ""}`.trim()
      : "there");

  if (!email) {
    console.warn(`Booking ${booking.id}: no email for acceptance notice`);
    return;
  }

  const payUrl = buildBookingPayUrl(token);
  const finalPrice = parseFloat(booking.final_price || 0).toFixed(2);
  const { startTime, endTime } = getAgreedBookingTimes(booking);

  const html = `
    <h2>Your coaching session is confirmed — payment required</h2>
    <p>Hi ${name},</p>
    <p>Your coach accepted your booking for <strong>${booking.topic}</strong>.</p>
    <p><strong>When:</strong> ${startTime.toLocaleString()} – ${endTime.toLocaleString()}</p>
    <p><strong>Amount:</strong> ${finalPrice} ${booking.currency || "NGN"}</p>
    <p><a href="${payUrl}">Complete payment</a></p>
    <p>After payment, we will email your meeting link. Do not share this payment link.</p>
    <p style="font-size:12px;color:#6b7280">Pinnacle</p>
  `;

  await emailService.sendEmail({
    to: email,
    name,
    subject: `Pay for your coaching session: ${booking.topic}`,
    htmlBody: html,
  });
}

export async function sendBookingMeetingLinkEmail(booking, session) {
  const email =
    normalizeEmail(booking.guest_email) ||
    normalizeEmail(booking.student?.email);
  const name =
    booking.guest_name ||
    (booking.student
      ? `${booking.student.fname || ""} ${booking.student.lname || ""}`.trim()
      : "there");

  if (!email) return;

  const meetingUrl =
    session.view_link ||
    joinFrontendUrl(
      process.env.FRONTEND_URL || Config.frontendUrl,
      `coaching/sessions/${session.id}`
    );

  const html = `
    <h2>Your coaching session is booked</h2>
    <p>Hi ${name},</p>
    <p>Payment received for <strong>${session.title}</strong>.</p>
    <p><strong>Starts:</strong> ${new Date(session.start_time).toLocaleString()}</p>
    <p><a href="${meetingUrl}">Open meeting page</a></p>
    <p style="font-size:12px;color:#6b7280">Pinnacle</p>
  `;

  await emailService.sendEmail({
    to: email,
    name,
    subject: `Meeting link: ${session.title}`,
    htmlBody: html,
  });
}

/**
 * Create session + credit tutor after successful payment (wallet, card, or BVA).
 */
export async function fulfillAcceptedBookingPayment(
  bookingId,
  {
    paymentMethod,
    txRef,
    payerStudentId = null,
    paidAmount = null,
    paidCurrency = null,
  }
) {
  const dbTransaction = await db.transaction();
  try {
    const booking = await CoachingBookingRequest.findByPk(bookingId, {
      lock: Transaction.LOCK.UPDATE,
      transaction: dbTransaction,
      include: [{ model: Students, as: "student", required: false }],
    });

    await assertBookingPayable(booking);

    const effectiveStudentId = booking.student_id || payerStudentId || null;
    let student = null;
    if (effectiveStudentId) {
      student = await Students.findByPk(effectiveStudentId, {
        transaction: dbTransaction,
        lock: Transaction.LOCK.UPDATE,
      });
    }

    const finalPrice = parseFloat(booking.final_price);
    if (!finalPrice || finalPrice <= 0) {
      throw new ErrorClass("Invalid booking price", 400);
    }

    const generalSetup = await GeneralSetup.findOne({
      order: [["id", "DESC"]],
      transaction: dbTransaction,
    });
    const exchangeRate = parseFloat(generalSetup?.rate || "1500");
    const bookingCurrency = (booking.currency || "NGN").toUpperCase();

    let priceCharged = finalPrice;
    let chargeCurrency = bookingCurrency;

    if (paymentMethod === "wallet") {
      if (!student) {
        throw new ErrorClass("Student account required for wallet payment", 400);
      }
      const studentCurrency = (student.currency || "NGN").toUpperCase();
      priceCharged = finalPrice;
      if (bookingCurrency !== studentCurrency) {
        if (bookingCurrency === "USD" && studentCurrency === "NGN") {
          priceCharged = finalPrice * exchangeRate;
        } else if (bookingCurrency === "NGN" && studentCurrency === "USD") {
          priceCharged = finalPrice / exchangeRate;
        }
      }
      chargeCurrency = studentCurrency;

      const walletBalance = await calculateWalletBalanceFromFunding(
        student.id,
        student.currency,
        dbTransaction
      );
      if (walletBalance < priceCharged) {
        throw new ErrorClass(
          `Insufficient wallet balance. Required: ${priceCharged.toFixed(2)} ${chargeCurrency}`,
          400
        );
      }

      const newBalance = walletBalance - priceCharged;
      const today = new Date().toISOString().split("T")[0];
      await Funding.create(
        {
          student_id: student.id,
          amount: priceCharged,
          type: "Debit",
          service_name: "Coaching Session Booking",
          ref: txRef,
          date: today,
          semester: null,
          academic_year: null,
          currency: chargeCurrency,
          balance: newBalance.toString(),
        },
        { transaction: dbTransaction }
      );
      await student.update(
        { wallet_balance: newBalance },
        { transaction: dbTransaction }
      );
    } else {
      if (paidAmount != null) {
        const expected = finalPrice;
        if (Math.abs(parseFloat(paidAmount) - expected) > 0.02) {
          throw new ErrorClass("Payment amount does not match booking price", 400);
        }
      }
      chargeCurrency = (paidCurrency || bookingCurrency).toUpperCase();
      priceCharged = parseFloat(paidAmount ?? finalPrice);
    }

    const { startTime, endTime, durationMinutes } = getAgreedBookingTimes(booking);
    const durationHours = durationMinutes / 60;
    const commissionRate = 15.0;
    const wspCommission = (priceCharged * commissionRate) / 100;
    const tutorEarnings = priceCharged - wspCommission;

    try {
      await checkAndDeductHours(
        booking.tutor_id,
        booking.tutor_type,
        durationHours,
        dbTransaction
      );
    } catch (hoursError) {
      console.warn("Hours deduction skipped:", hoursError.message);
    }

    const callUuid = crypto.randomUUID();
    const streamCallId = `coaching_${booking.tutor_id}_${callUuid}`;

    if (Config.streamApiKey && Config.streamSecret) {
      try {
        await streamVideoService.getOrCreateCall("default", streamCallId, {
          createdBy: formatStreamUserId(booking.tutor_type, booking.tutor_id),
          record: false,
          startsAt: startTime.toISOString(),
        });
      } catch (streamError) {
        console.error("Stream.io call creation failed:", streamError.message);
      }
    }

    const viewLink = joinFrontendUrl(
      Config.frontendUrl,
      `coaching/session/${streamCallId}`
    );

    const session = await CoachingSession.create(
      {
        tutor_id: booking.tutor_id,
        tutor_type: booking.tutor_type,
        title: `One-on-One: ${booking.topic}`,
        description: booking.description || null,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        stream_call_id: streamCallId,
        view_link: viewLink,
        status: "scheduled",
        hours_reserved: durationHours,
        hours_used: 0.0,
        student_count: 1,
        pricing_type: "paid",
        price: finalPrice,
        currency: booking.currency,
        category: booking.category || null,
        commission_rate: commissionRate,
        session_type: "one_on_one",
        agreed_start_time: startTime,
        agreed_end_time: endTime,
      },
      { transaction: dbTransaction }
    );

    const guestEmail = booking.guest_email
      ? normalizeEmail(booking.guest_email)
      : null;

    if (student) {
      await CoachingParticipant.create(
        {
          session_id: session.id,
          student_id: student.id,
          email_sent: true,
        },
        { transaction: dbTransaction }
      );
    } else if (guestEmail) {
      await CoachingParticipant.create(
        {
          session_id: session.id,
          student_id: null,
          guest_email: guestEmail,
          email_sent: true,
        },
        { transaction: dbTransaction }
      );
    }

    const purchase = await CoachingSessionPurchase.create(
      {
        session_id: session.id,
        student_id: student?.id || null,
        guest_email: student ? null : guestEmail,
        price_paid: priceCharged,
        currency: chargeCurrency,
        commission_rate: commissionRate,
        wsp_commission: wspCommission,
        tutor_earnings: tutorEarnings,
        transaction_ref: txRef,
        payment_method: paymentMethod,
      },
      { transaction: dbTransaction }
    );

    if (wspCommission > 0) {
      await WspCommission.create(
        {
          transaction_id: purchase.id,
          amount: wspCommission,
          currency: chargeCurrency,
          status: "collected",
          collected_at: new Date(),
        },
        { transaction: dbTransaction }
      );
    }

    let tutor;
    if (booking.tutor_type === "sole_tutor") {
      tutor = await SoleTutor.findByPk(booking.tutor_id, {
        transaction: dbTransaction,
        lock: Transaction.LOCK.UPDATE,
      });
    } else {
      tutor = await Organization.findByPk(booking.tutor_id, {
        transaction: dbTransaction,
        lock: Transaction.LOCK.UPDATE,
      });
    }

    if (tutor) {
      const tutorCreditCurrency = chargeCurrency;
      let tutorWalletField = "wallet_balance_primary";
      if (tutorCreditCurrency === "USD") tutorWalletField = "wallet_balance_usd";
      if (tutorCreditCurrency === "GBP") tutorWalletField = "wallet_balance_gbp";

      const tutorWalletBefore = parseFloat(tutor[tutorWalletField] || 0);
      const tutorWalletAfter = tutorWalletBefore + tutorEarnings;
      const newTotalEarnings =
        parseFloat(tutor.total_earnings || 0) + tutorEarnings;

      const tutorUpd = {
        total_earnings: newTotalEarnings,
        [tutorWalletField]: tutorWalletAfter,
      };
      if (tutorWalletField === "wallet_balance_primary") {
        applyLegacyWalletMirror(tutorUpd, tutorWalletAfter);
      }
      await tutor.update(tutorUpd, { transaction: dbTransaction });

      await TutorWalletTransaction.create(
        {
          tutor_id: booking.tutor_id,
          tutor_type: booking.tutor_type,
          transaction_type: "credit",
          amount: tutorEarnings,
          currency: tutorCreditCurrency,
          service_name: "One-on-One Coaching Booking",
          transaction_reference: txRef,
          balance_before: tutorWalletBefore,
          balance_after: tutorWalletAfter,
          related_id: booking.id,
          related_type: "coaching_booking_request",
          status: "successful",
          notes: "Tutor earnings credited after booking payment",
          metadata: {
            booking_id: booking.id,
            purchase_id: purchase.id,
            session_id: session.id,
          },
        },
        { transaction: dbTransaction }
      );
    }

    await booking.update(
      {
        session_id: session.id,
        transaction_ref: txRef,
        payment_method: paymentMethod,
        paid_at: new Date(),
      },
      { transaction: dbTransaction }
    );

    await TutorCoachingProfile.increment("total_sessions_completed", {
      by: 1,
      where: {
        tutor_id: booking.tutor_id,
        tutor_type: booking.tutor_type,
      },
      transaction: dbTransaction,
    });

    await dbTransaction.commit();

    const bookingPlain = await CoachingBookingRequest.findByPk(bookingId, {
      include: [{ model: Students, as: "student", required: false }],
    });

    sendBookingMeetingLinkEmail(bookingPlain, session).catch((err) =>
      console.error("Booking meeting email error:", err.message)
    );

    return {
      booking: bookingPlain,
      session,
      purchase,
      stream_call_id: streamCallId,
      view_link: viewLink,
    };
  } catch (error) {
    await dbTransaction.rollback();
    throw error;
  }
}

export async function fulfillBookingFromWebhook(txRef, transactionData) {
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
    paymentMethod: "flutterwave",
    txRef,
    paidAmount: getTransactionAmount(transactionData),
    paidCurrency: getTransactionCurrency(transactionData),
    payerStudentId: booking.student_id || null,
  });

  return { handled: true };
}

export async function claimGuestCoachingBookingsForStudent(studentId, email) {
  const normalized = normalizeEmail(email);
  const bookings = await CoachingBookingRequest.findAll({
    where: {
      guest_email: normalized,
      student_id: null,
      session_id: { [Op.ne]: null },
    },
  });

  let linked = 0;
  for (const b of bookings) {
    await b.update({ student_id: studentId });
    if (b.session_id) {
      await CoachingParticipant.update(
        { student_id: studentId, guest_email: null },
        { where: { session_id: b.session_id, guest_email: normalized } }
      );
      await CoachingSessionPurchase.update(
        { student_id: studentId, guest_email: null },
        { where: { session_id: b.session_id, guest_email: normalized } }
      );
    }
    linked += 1;
  }
  return linked;
}
