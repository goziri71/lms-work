import crypto from "crypto";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CoachingBookingRequest } from "../../models/marketplace/coachingBookingRequest.js";
import { CoachingSession } from "../../models/marketplace/coachingSession.js";
import { CoachingSessionPurchase } from "../../models/marketplace/coachingSessionPurchase.js";
import { CoachingParticipant } from "../../models/marketplace/coachingParticipant.js";
import { TutorCoachingProfile } from "../../models/marketplace/tutorCoachingProfile.js";
import { Students } from "../../models/auth/student.js";
import { Funding } from "../../models/payment/funding.js";
import { GeneralSetup } from "../../models/settings/generalSetup.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { WspCommission } from "../../models/marketplace/wspCommission.js";
import { getWalletBalance } from "../../services/walletBalanceService.js";
import { streamVideoService } from "../../service/streamVideoService.js";
import { checkAndDeductHours } from "./coachingHours.js";
import { Config } from "../../config/config.js";
import { db } from "../../database/database.js";

/**
 * Process payment and create session after booking is accepted.
 * Called by the party that does NOT accept — the acceptor's endpoint triggers this.
 *
 * Flow:
 * 1. Tutor accepts student's time  -> tutor calls accept  -> this processes payment
 * 2. Student accepts counter-offer  -> student calls accept-counter -> this processes payment
 *
 * POST /api/marketplace/coaching/booking/:id/process-payment
 * Auth: Student required (student is always the one paying)
 */
export const processBookingPayment = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) {
    throw new ErrorClass("Authentication required", 401);
  }

  const { id } = req.params;

  const booking = await CoachingBookingRequest.findOne({
    where: { id, student_id: studentId, status: "accepted" },
  });

  if (!booking) {
    throw new ErrorClass(
      "Booking not found or not yet accepted. Both parties must agree before payment.",
      404
    );
  }

  if (booking.session_id) {
    throw new ErrorClass("This booking has already been processed and a session created", 400);
  }

  // Determine the agreed-upon times
  const isCounterAccepted = booking.accepted_by === "student";
  const agreedStartTime = isCounterAccepted
    ? new Date(booking.counter_proposed_start_time)
    : new Date(booking.proposed_start_time);
  const agreedEndTime = isCounterAccepted
    ? new Date(booking.counter_proposed_end_time)
    : new Date(booking.proposed_end_time);
  const agreedDuration = isCounterAccepted
    ? booking.counter_proposed_duration_minutes
    : booking.proposed_duration_minutes;

  if (agreedStartTime <= new Date()) {
    throw new ErrorClass("The agreed session time has already passed. Please create a new booking request.", 400);
  }

  const finalPrice = parseFloat(booking.final_price);
  if (!finalPrice || finalPrice <= 0) {
    throw new ErrorClass("Invalid booking price", 400);
  }

  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Currency conversion
  const generalSetup = await GeneralSetup.findOne({ order: [["id", "DESC"]] });
  const exchangeRate = parseFloat(generalSetup?.rate || "1500");

  const bookingCurrency = (booking.currency || "NGN").toUpperCase();
  const studentCurrency = (student.currency || "NGN").toUpperCase();

  let priceInStudentCurrency = finalPrice;
  if (bookingCurrency !== studentCurrency) {
    if (bookingCurrency === "USD" && studentCurrency === "NGN") {
      priceInStudentCurrency = finalPrice * exchangeRate;
    } else if (bookingCurrency === "NGN" && studentCurrency === "USD") {
      priceInStudentCurrency = finalPrice / exchangeRate;
    }
  }

  // Check wallet balance
  const { balance: walletBalance } = await getWalletBalance(studentId, true);

  if (walletBalance < priceInStudentCurrency) {
    let requiredDisplay;
    if (bookingCurrency !== studentCurrency) {
      requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency} (${finalPrice} ${bookingCurrency})`;
    } else {
      requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency}`;
    }

    throw new ErrorClass(
      `Insufficient wallet balance. Required: ${requiredDisplay}, Available: ${walletBalance.toFixed(2)} ${studentCurrency}. Please fund your wallet first.`,
      400
    );
  }

  const commissionRate = 15.0;
  const wspCommission = (priceInStudentCurrency * commissionRate) / 100;
  const tutorEarnings = priceInStudentCurrency - wspCommission;
  const txRef = `COACHING-BOOKING-${id}-${Date.now()}`;
  const today = new Date().toISOString().split("T")[0];
  const durationHours = agreedDuration / 60;

  const dbTransaction = await db.transaction();

  try {
    // 1. Debit student wallet
    const newBalance = walletBalance - priceInStudentCurrency;

    await Funding.create(
      {
        student_id: studentId,
        amount: priceInStudentCurrency,
        type: "Debit",
        service_name: "Coaching Session Booking",
        ref: txRef,
        date: today,
        semester: null,
        academic_year: null,
        currency: studentCurrency,
        balance: newBalance.toString(),
      },
      { transaction: dbTransaction }
    );

    await student.update(
      { wallet_balance: newBalance },
      { transaction: dbTransaction }
    );

    // 2. Check and deduct tutor coaching hours
    let hoursCheck;
    try {
      hoursCheck = await checkAndDeductHours(
        booking.tutor_id,
        booking.tutor_type,
        durationHours,
        dbTransaction
      );
    } catch (hoursError) {
      console.warn("Hours deduction skipped:", hoursError.message);
      hoursCheck = { allowed: true, unlimited: true };
    }

    if (!hoursCheck.allowed) {
      throw new ErrorClass(
        `Tutor does not have enough coaching hours: ${hoursCheck.reason}`,
        400
      );
    }

    // 3. Create Stream.io video call
    const callUuid = crypto.randomUUID();
    const streamCallId = `coaching_${booking.tutor_id}_${callUuid}`;

    if (Config.streamApiKey && Config.streamSecret) {
      try {
        await streamVideoService.getOrCreateCall("default", streamCallId, {
          createdBy: String(booking.tutor_id),
          record: false,
          startsAt: agreedStartTime.toISOString(),
        });
      } catch (streamError) {
        console.error("Stream.io call creation failed:", streamError.message);
      }
    }

    const viewLink = `${Config.frontendUrl}/coaching/session/${streamCallId}`;

    // 4. Create coaching session
    const session = await CoachingSession.create(
      {
        tutor_id: booking.tutor_id,
        tutor_type: booking.tutor_type,
        title: `One-on-One: ${booking.topic}`,
        description: booking.description || null,
        start_time: agreedStartTime,
        end_time: agreedEndTime,
        duration_minutes: agreedDuration,
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
        agreed_start_time: agreedStartTime,
        agreed_end_time: agreedEndTime,
      },
      { transaction: dbTransaction }
    );

    // 5. Add student as participant
    await CoachingParticipant.create(
      {
        session_id: session.id,
        student_id: studentId,
        email_sent: false,
      },
      { transaction: dbTransaction }
    );

    // 6. Create purchase record
    const purchase = await CoachingSessionPurchase.create(
      {
        session_id: session.id,
        student_id: studentId,
        price_paid: priceInStudentCurrency,
        currency: studentCurrency,
        commission_rate: commissionRate,
        wsp_commission: wspCommission,
        tutor_earnings: tutorEarnings,
        transaction_ref: txRef,
        payment_method: "wallet",
      },
      { transaction: dbTransaction }
    );

    // 7. Record platform commission
    if (wspCommission > 0) {
      await WspCommission.create(
        {
          transaction_id: purchase.id,
          amount: wspCommission,
          currency: studentCurrency,
          status: "collected",
          collected_at: new Date(),
        },
        { transaction: dbTransaction }
      );
    }

    // 8. Credit tutor earnings
    let tutor;
    if (booking.tutor_type === "sole_tutor") {
      tutor = await SoleTutor.findByPk(booking.tutor_id, {
        transaction: dbTransaction,
      });
    } else {
      tutor = await Organization.findByPk(booking.tutor_id, {
        transaction: dbTransaction,
      });
    }

    if (tutor) {
      const newTotalEarnings =
        parseFloat(tutor.total_earnings || 0) + tutorEarnings;
      await tutor.update(
        { total_earnings: newTotalEarnings },
        { transaction: dbTransaction }
      );
    }

    // 9. Update booking with session reference
    await booking.update(
      { session_id: session.id },
      { transaction: dbTransaction }
    );

    // 10. Increment tutor's completed sessions count
    await TutorCoachingProfile.increment("total_sessions_completed", {
      by: 1,
      where: {
        tutor_id: booking.tutor_id,
        tutor_type: booking.tutor_type,
      },
      transaction: dbTransaction,
    });

    await dbTransaction.commit();

    res.status(201).json({
      success: true,
      message: "Payment processed and coaching session created successfully",
      data: {
        booking_id: booking.id,
        session_id: session.id,
        stream_call_id: streamCallId,
        view_link: viewLink,
        price_paid: priceInStudentCurrency,
        currency: studentCurrency,
        transaction_ref: txRef,
        new_wallet_balance: newBalance,
        session: {
          id: session.id,
          title: session.title,
          start_time: session.start_time,
          end_time: session.end_time,
          duration_minutes: session.duration_minutes,
          status: session.status,
        },
      },
    });
  } catch (error) {
    await dbTransaction.rollback();
    throw error;
  }
});

/**
 * Get booking payment details (preview before paying)
 * GET /api/marketplace/coaching/booking/:id/payment-preview
 * Auth: Student required
 */
export const getBookingPaymentPreview = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) {
    throw new ErrorClass("Authentication required", 401);
  }

  const { id } = req.params;

  const booking = await CoachingBookingRequest.findOne({
    where: { id, student_id: studentId, status: "accepted" },
  });

  if (!booking) {
    throw new ErrorClass("No accepted booking found", 404);
  }

  if (booking.session_id) {
    throw new ErrorClass("This booking has already been processed", 400);
  }

  const student = await Students.findByPk(studentId);
  const generalSetup = await GeneralSetup.findOne({ order: [["id", "DESC"]] });
  const exchangeRate = parseFloat(generalSetup?.rate || "1500");

  const bookingCurrency = (booking.currency || "NGN").toUpperCase();
  const studentCurrency = (student?.currency || "NGN").toUpperCase();
  const finalPrice = parseFloat(booking.final_price);

  let priceInStudentCurrency = finalPrice;
  if (bookingCurrency !== studentCurrency) {
    if (bookingCurrency === "USD" && studentCurrency === "NGN") {
      priceInStudentCurrency = finalPrice * exchangeRate;
    } else if (bookingCurrency === "NGN" && studentCurrency === "USD") {
      priceInStudentCurrency = finalPrice / exchangeRate;
    }
  }

  const { balance: walletBalance } = await getWalletBalance(studentId, true);

  const isCounterAccepted = booking.accepted_by === "student";
  const agreedStartTime = isCounterAccepted
    ? booking.counter_proposed_start_time
    : booking.proposed_start_time;
  const agreedEndTime = isCounterAccepted
    ? booking.counter_proposed_end_time
    : booking.proposed_end_time;
  const agreedDuration = isCounterAccepted
    ? booking.counter_proposed_duration_minutes
    : booking.proposed_duration_minutes;

  const commissionRate = 15.0;
  const platformFee = (priceInStudentCurrency * commissionRate) / 100;

  res.status(200).json({
    success: true,
    data: {
      booking_id: booking.id,
      topic: booking.topic,
      agreed_start_time: agreedStartTime,
      agreed_end_time: agreedEndTime,
      agreed_duration_minutes: agreedDuration,
      price: finalPrice,
      price_currency: bookingCurrency,
      price_in_your_currency: Math.round(priceInStudentCurrency * 100) / 100,
      your_currency: studentCurrency,
      platform_fee: Math.round(platformFee * 100) / 100,
      wallet_balance: Math.round(walletBalance * 100) / 100,
      can_afford: walletBalance >= priceInStudentCurrency,
      shortfall:
        walletBalance < priceInStudentCurrency
          ? Math.round((priceInStudentCurrency - walletBalance) * 100) / 100
          : 0,
    },
  });
});
