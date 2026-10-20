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
import { OrganizationUser } from "../models/marketplace/organizationUser.js";
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
import { releaseCalendarHoldAfterPayment } from "./coachingCalendarService.js";
import { getAgreedBookingTimes } from "../utils/coachingBookingTimes.js";

// Re-exported: coachingBookingPayment.js (and others) import this from here
// rather than from utils/coachingBookingTimes.js directly — dropping this
// re-export breaks their import at module-load time (ESM named-export
// errors crash the whole process on boot, not just the one route), which is
// exactly what took production down after this line was accidentally
// removed.
export { getAgreedBookingTimes };

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

export function buildTutorBookingRequestsUrl(bookingId) {
  const base = process.env.ADMIN_FRONTEND_URL || Config.adminFrontendUrl;
  const path = bookingId
    ? `coaching/booking-requests/${bookingId}`
    : "coaching/booking-requests";
  return joinFrontendUrl(base, path);
}

function buildTutorSessionUrl(session) {
  return (
    session.view_link ||
    joinFrontendUrl(
      process.env.ADMIN_FRONTEND_URL || Config.adminFrontendUrl,
      `coaching/session/${session.stream_call_id || session.id}`
    )
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

/** Resolve buyer email/name even when Sequelize include did not load student. */
export async function resolveBookingRecipient(booking) {
  let email = normalizeEmail(booking.guest_email);
  let name = booking.guest_name?.trim() || null;

  if (!email && booking.student_id) {
    const student =
      booking.student ||
      (await Students.findByPk(booking.student_id, {
        attributes: ["id", "email", "fname", "lname"],
      }));
    if (student) {
      email = normalizeEmail(student.email);
      if (!name) {
        name = `${student.fname || ""} ${student.lname || ""}`.trim() || null;
      }
    }
  }

  return { email, name: name || "there" };
}

/**
 * All inboxes that should receive tutor-side coaching booking emails.
 * - sole_tutor: SoleTutor.email
 * - organization: Organization.email + active admin/manager org users (deduped)
 */
export async function resolveTutorNotificationRecipients(booking) {
  const tutorId = booking?.tutor_id;
  const tutorType = String(booking?.tutor_type || "").trim();

  if (!tutorId || !tutorType) {
    return [];
  }

  if (tutorType === "sole_tutor") {
    const tutor = await SoleTutor.findByPk(tutorId, {
      attributes: ["id", "fname", "lname", "email"],
    });
    const email = normalizeEmail(tutor?.email);
    if (!email) return [];
    return [
      {
        email,
        name: `${tutor.fname || ""} ${tutor.lname || ""}`.trim() || "Coach",
      },
    ];
  }

  if (tutorType === "organization") {
    const recipients = [];
    const seen = new Set();

    const org = await Organization.findByPk(tutorId, {
      attributes: ["id", "name", "email"],
    });
    const orgEmail = normalizeEmail(org?.email);
    if (orgEmail) {
      seen.add(orgEmail);
      recipients.push({
        email: orgEmail,
        name: org?.name || "Organization",
      });
    }

    const orgUsers = await OrganizationUser.findAll({
      where: {
        organization_id: tutorId,
        status: "active",
      },
      attributes: ["email", "fname", "lname", "role"],
    });
    for (const user of orgUsers) {
      const email = normalizeEmail(user.email);
      if (!email || seen.has(email)) continue;
      seen.add(email);
      recipients.push({
        email,
        name:
          `${user.fname || ""} ${user.lname || ""}`.trim() ||
          org?.name ||
          "Organization",
      });
    }

    return recipients;
  }

  console.warn(
    `Booking ${booking?.id}: unknown tutor_type "${tutorType}" — no tutor emails`
  );
  return [];
}

/** @deprecated Prefer resolveTutorNotificationRecipients */
export async function resolveTutorRecipient(booking) {
  const list = await resolveTutorNotificationRecipients(booking);
  return list[0] || { email: null, name: "Coach" };
}

async function sendNomadaEmailToTutorRecipients(bookingId, recipients, payload) {
  if (!recipients.length) {
    console.warn(
      `Booking ${bookingId}: no tutor notification recipients (check tutor_id / tutor_type and org or sole tutor email)`
    );
    return;
  }
  for (const recipient of recipients) {
    await sendNomadaEmail({
      to: recipient.email,
      name: recipient.name,
      subject: payload.subject,
      htmlBody: payload.htmlBody(recipient.name),
    });
  }
}

/** Reload booking row without Sequelize includes (safe before associations init). */
async function reloadBookingRowForEmail(booking) {
  if (booking?.id == null) return booking;
  return CoachingBookingRequest.findByPk(booking.id);
}

async function buyerSummaryForTutor(booking) {
  const { email, name } = await resolveBookingRecipient(booking);
  const contact = email || booking.guest_phone || "Not provided";
  const who = name && name !== "there" ? `${name} (${contact})` : contact;
  return { who, email, name };
}

async function sendNomadaEmail({ to, name, subject, htmlBody }) {
  const result = await emailService.sendEmail({
    to,
    name,
    subject,
    htmlBody,
    useTutorLearnerBranding: true,
  });
  if (!result.success) {
    throw new Error(result.message || "Email delivery failed");
  }
  return result;
}

/** Tutor notifications — failures are logged only; never block buyer flows. */
export function notifyTutorCoachingEmail(booking, sender) {
  sender(booking).catch((err) =>
    console.error(
      `Tutor coaching email error (booking ${booking?.id}):`,
      err.message,
      err.stack
    )
  );
}

/** 1) New pending booking request */
export async function sendTutorNewBookingRequestEmail(booking) {
  const row = await reloadBookingRowForEmail(booking);
  if (!row) {
    console.warn(
      `sendTutorNewBookingRequestEmail: booking not found (id=${booking?.id})`
    );
    return;
  }

  const recipients = await resolveTutorNotificationRecipients(row);
  const buyer = await buyerSummaryForTutor(row);
  const dashboardUrl = buildTutorBookingRequestsUrl(row.id);
  const start = new Date(row.proposed_start_time);
  const end = new Date(row.proposed_end_time);

  await sendNomadaEmailToTutorRecipients(row.id, recipients, {
    subject: `New booking request: ${row.topic}`,
    htmlBody: (tutorName) => `
    <h2>New coaching booking request</h2>
    <p>Hi ${tutorName},</p>
    <p><strong>${buyer.who}</strong> requested a 1-on-1 session.</p>
    <p><strong>Topic:</strong> ${row.topic}</p>
    <p><strong>Proposed time:</strong> ${start.toLocaleString()} – ${end.toLocaleString()}</p>
    <p><strong>Estimated price:</strong> ${parseFloat(row.estimated_price || 0).toFixed(2)} ${row.currency || "NGN"}</p>
    ${row.student_note ? `<p><strong>Note from buyer:</strong> ${row.student_note}</p>` : ""}
    <p><a href="${dashboardUrl}">Review and respond</a></p>
    <p style="font-size:12px;color:#6b7280">Nomada</p>
  `,
  });
  if (recipients.length) {
    console.log(
      `✅ Booking ${row.id}: new-request email sent to ${recipients.map((r) => r.email).join(", ")}`
    );
  }
}

/** 2) Accepted — waiting for buyer payment */
export async function sendTutorAwaitingPaymentEmail(booking) {
  const row = await reloadBookingRowForEmail(booking);
  if (!row) return;

  const recipients = await resolveTutorNotificationRecipients(row);
  const buyer = await buyerSummaryForTutor(row);
  const { startTime, endTime } = getAgreedBookingTimes(row);
  const finalPrice = parseFloat(row.final_price || 0).toFixed(2);
  const due = row.expires_at
    ? new Date(row.expires_at).toLocaleString()
    : "soon";

  await sendNomadaEmailToTutorRecipients(row.id, recipients, {
    subject: `Awaiting payment: ${row.topic}`,
    htmlBody: (tutorName) => `
    <h2>Booking accepted — awaiting payment</h2>
    <p>Hi ${tutorName},</p>
    <p>You accepted a session with <strong>${buyer.who}</strong>.</p>
    <p><strong>Topic:</strong> ${row.topic}</p>
    <p><strong>When:</strong> ${startTime.toLocaleString()} – ${endTime.toLocaleString()}</p>
    <p><strong>Amount:</strong> ${finalPrice} ${row.currency || "NGN"}</p>
    <p>The buyer was emailed a payment link. Payment is due by <strong>${due}</strong>.</p>
    <p><a href="${buildTutorBookingRequestsUrl(row.id)}">View booking</a></p>
    <p style="font-size:12px;color:#6b7280">Nomada</p>
  `,
  });
  if (recipients.length) {
    console.log(
      `✅ Booking ${row.id}: awaiting-payment email sent to ${recipients.map((r) => r.email).join(", ")}`
    );
  }
}

/** 3) Paid (or free) — session confirmed */
export async function sendTutorSessionConfirmedEmail(booking, session) {
  const row = await reloadBookingRowForEmail(booking);
  if (!row || !session) return;

  const recipients = await resolveTutorNotificationRecipients(row);
  const buyer = await buyerSummaryForTutor(row);
  const sessionUrl = buildTutorSessionUrl(session);
  const paidLabel =
    row.payment_method === "free" || parseFloat(row.final_price || 0) <= 0
      ? "Free session confirmed"
      : "Payment received — session confirmed";

  await sendNomadaEmailToTutorRecipients(row.id, recipients, {
    subject: `Session confirmed: ${session.title}`,
    htmlBody: (tutorName) => `
    <h2>${paidLabel}</h2>
    <p>Hi ${tutorName},</p>
    <p>Your 1-on-1 with <strong>${buyer.who}</strong> is confirmed.</p>
    <p><strong>Session:</strong> ${session.title}</p>
    <p><strong>Starts:</strong> ${new Date(session.start_time).toLocaleString()}</p>
    <p><a href="${sessionUrl}">Open your session page</a></p>
    <p><a href="${buildTutorBookingRequestsUrl(row.id)}">View booking details</a></p>
    <p style="font-size:12px;color:#6b7280">Nomada</p>
  `,
  });
  if (recipients.length) {
    console.log(
      `✅ Booking ${row.id}: session-confirmed email sent to ${recipients.map((r) => r.email).join(", ")}`
    );
  }
}

/**
 * Guards every booking-payment entry point (init-payment, confirm-payment,
 * BVA create/confirm). Access is granted if EITHER the requester is logged
 * in as the exact student who owns this booking, OR they present the
 * booking's own access_token (every booking, guest or student-owned, gets
 * one — e.g. for the "pay" link in the acceptance email). What this must
 * NOT allow: an unrelated logged-in student reaching someone else's booking
 * just because its student_id happens to be null (a guest booking) — a
 * previous version of this check (duplicated separately in both
 * coachingBookingPublic.js and bvaPaymentService.js) only verified
 * ownership when student_id was set, which let any logged-in student
 * bypass the access_token requirement entirely for guest bookings. Now a
 * single shared implementation so both call sites can't drift apart again.
 */
export function assertCanActOnBooking(booking, studentId, accessToken) {
  const ownsAsStudent = studentId != null && booking.student_id === studentId;
  const hasValidToken = !!accessToken && accessToken === booking.access_token;
  if (!ownsAsStudent && !hasValidToken) {
    throw new ErrorClass(
      booking.student_id ? "Forbidden" : "Valid access_token is required",
      403
    );
  }
}

export async function assertBookingPayable(booking, { allowFree = false } = {}) {
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
  if (!allowFree && isFreeBooking(booking)) {
    // Free bookings are fulfilled automatically right after acceptance
    // (see acceptBookingRequest/acceptCounterProposal) — there's nothing to
    // pay, so no payment entry point (init-payment, confirm-payment, BVA)
    // should ever reach this far for one. If it's still unfulfilled, the
    // automatic fulfillment hasn't finished yet rather than needing payment.
    // `allowFree` is set by fulfillAcceptedBookingPayment itself when it's
    // the one doing that automatic free fulfillment (paymentMethod
    // "free") — without it, this check would reject its own call and the
    // free booking would silently never get fulfilled or emailed at all.
    throw new ErrorClass(
      "This is a free booking — no payment is required. The session is being created automatically.",
      400
    );
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
  const row =
    booking?.id != null
      ? await CoachingBookingRequest.findByPk(booking.id, {
          include: [{ model: Students, as: "student", required: false }],
        })
      : booking;
  if (!row) throw new Error("Booking not found for payment email");

  const token = row.access_token || generateGuestAccessToken();
  if (!row.access_token) {
    await row.update({ access_token: token });
  }

  const { email, name } = await resolveBookingRecipient(row);
  if (!email) {
    throw new Error(
      `Booking ${row.id}: no buyer email (guest_email or student record)`
    );
  }

  const payUrl = buildBookingPayUrl(token);
  const finalPrice = parseFloat(row.final_price || 0).toFixed(2);
  const { startTime, endTime } = getAgreedBookingTimes(row);

  const html = `
    <h2>Your coaching session is confirmed — payment required</h2>
    <p>Hi ${name},</p>
    <p>Your coach accepted your booking for <strong>${row.topic}</strong>.</p>
    <p><strong>When:</strong> ${startTime.toLocaleString()} – ${endTime.toLocaleString()}</p>
    <p><strong>Amount:</strong> ${finalPrice} ${row.currency || "NGN"}</p>
    <p><a href="${payUrl}">Complete payment</a></p>
    <p>Or copy this link: ${payUrl}</p>
    <p>After payment, we will email your meeting link. Do not share this payment link.</p>
    <p style="font-size:12px;color:#6b7280">Nomada</p>
  `;

  await sendNomadaEmail({
    to: email,
    name,
    subject: `Pay for your coaching session: ${row.topic}`,
    htmlBody: html,
  });

  console.log(
    `✅ Coaching booking ${row.id}: payment link email sent to ${email}`
  );
  return { email, payUrl };
}

export async function resendBookingPaymentEmailByAccessToken(accessToken) {
  const booking = await CoachingBookingRequest.findOne({
    where: { access_token: accessToken },
    include: [{ model: Students, as: "student", required: false }],
  });
  if (!booking) throw new ErrorClass("Booking not found", 404);
  if (booking.status !== "accepted") {
    throw new ErrorClass(
      `Payment email only applies to accepted bookings (status: ${booking.status})`,
      400
    );
  }
  if (booking.session_id) {
    throw new ErrorClass("This booking is already paid", 400);
  }
  return sendBookingAcceptedPaymentEmail(booking);
}

export async function sendBookingMeetingLinkEmail(booking, session) {
  const row =
    booking?.id != null
      ? await CoachingBookingRequest.findByPk(booking.id, {
          include: [{ model: Students, as: "student", required: false }],
        })
      : booking;
  if (!row) throw new Error("Booking not found for meeting email");

  const { email, name } = await resolveBookingRecipient(row);
  if (!email) {
    throw new Error(`Booking ${row.id}: no email for meeting link`);
  }

  const meetingUrl =
    session.view_link ||
    joinFrontendUrl(
      Config.adminFrontendUrl,
      `coaching/session/${session.stream_call_id || session.id}`
    );

  const html = `
    <h2>Your coaching session is booked</h2>
    <p>Hi ${name},</p>
    <p>Payment received for <strong>${session.title}</strong>.</p>
    <p><strong>Starts:</strong> ${new Date(session.start_time).toLocaleString()}</p>
    <p><a href="${meetingUrl}">Open meeting page</a></p>
    <p>Or copy this link: ${meetingUrl}</p>
    <p style="font-size:12px;color:#6b7280">Nomada</p>
  `;

  await sendNomadaEmail({
    to: email,
    name,
    subject: `Meeting link: ${session.title}`,
    htmlBody: html,
  });

  console.log(
    `✅ Coaching booking ${row.id}: meeting link email sent to ${email}`
  );
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
    // No `include` here: Postgres rejects `FOR UPDATE` on a query with a
    // LEFT OUTER JOIN on the nullable side ("FOR UPDATE cannot be applied
    // to the nullable side of an outer join") — and since student_id is
    // nullable (guest bookings), the student include would always be on
    // that nullable side. Not needed anyway: `student` is fetched
    // separately right below.
    const booking = await CoachingBookingRequest.findByPk(bookingId, {
      lock: Transaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    await assertBookingPayable(booking, { allowFree: paymentMethod === "free" });

    const effectiveStudentId = booking.student_id || payerStudentId || null;
    let student = null;
    if (effectiveStudentId) {
      student = await Students.findByPk(effectiveStudentId, {
        transaction: dbTransaction,
        lock: Transaction.LOCK.UPDATE,
      });
    }

    const isFree = paymentMethod === "free";
    const finalPrice = parseFloat(booking.final_price) || 0;
    if (!isFree && finalPrice <= 0) {
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

    if (isFree) {
      // Nothing to charge — skip straight to session creation below.
      priceCharged = 0;
      chargeCurrency = bookingCurrency;
    } else if (paymentMethod === "wallet") {
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

    // Use the tutor's own commission_rate (sole tutors default to 3.5%,
    // organizations to 15% — see their model defaults) instead of a flat
    // 15% for everyone, matching how coachingSessionPurchase.js and
    // bvaPaymentService.js already compute commission for other coaching
    // purchase flows.
    const commissionRate = parseFloat(tutor?.commission_rate ?? 15.0);
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

    // The /coaching/session/:streamCallId meeting page is currently only
    // served from the manage.* (admin/tutor) frontend, not app.* (student)
    // — confirmed by testing both directly: app.* 404s, manage.* loads the
    // page. Use adminFrontendUrl until app.* gets this route too, otherwise
    // every meeting-link email (including to guests/students) 404s.
    const viewLink = joinFrontendUrl(
      Config.adminFrontendUrl,
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
        pricing_type: isFree ? "free" : "paid",
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

    if (tutor && priceCharged > 0) {
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

    await releaseCalendarHoldAfterPayment(booking.id, dbTransaction);

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
      console.error(
        `Booking meeting email error (booking ${bookingId}):`,
        err.message,
        err.stack
      )
    );
    notifyTutorCoachingEmail(bookingPlain, (b) =>
      sendTutorSessionConfirmedEmail(b, session)
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

/**
 * For a booking whose final_price is 0 (free coaching) — there's nothing to
 * pay, so skip the whole payment-request-email / init-payment / confirm-
 * payment round trip and go straight to creating the session and sending
 * the meeting link. Called right after acceptance in coachingNegotiation.js.
 */
export async function fulfillFreeAcceptedBooking(bookingId) {
  return fulfillAcceptedBookingPayment(bookingId, {
    paymentMethod: "free",
    txRef: buildBookingTxRef(bookingId),
  });
}

export function isFreeBooking(booking) {
  return !(parseFloat(booking?.final_price) > 0);
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
