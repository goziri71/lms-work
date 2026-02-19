import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CoachingBookingRequest } from "../../models/marketplace/coachingBookingRequest.js";
import { CoachingSession } from "../../models/marketplace/coachingSession.js";
import { CoachingSessionPurchase } from "../../models/marketplace/coachingSessionPurchase.js";
import { Students } from "../../models/auth/student.js";
import { Funding } from "../../models/payment/funding.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { WspCommission } from "../../models/marketplace/wspCommission.js";
import { getWalletBalance } from "../../services/walletBalanceService.js";
import { refundHours } from "./coachingHours.js";
import { streamVideoService } from "../../service/streamVideoService.js";
import { db } from "../../database/database.js";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function getTutorInfo(req) {
  if (!req.user) throw new ErrorClass("User not authenticated", 401);
  if (!req.tutor) throw new ErrorClass("Tutor information not found", 403);

  const userType = req.user.userType;
  let tutorId, tutorType;

  if (userType === "sole_tutor") {
    tutorId = req.tutor.id;
    tutorType = "sole_tutor";
  } else if (userType === "organization") {
    tutorId = req.tutor.id;
    tutorType = "organization";
  } else if (userType === "organization_user") {
    tutorId = req.tutor.organization_id;
    tutorType = "organization";
  } else {
    throw new ErrorClass("Invalid user type", 403);
  }

  return { tutorId, tutorType };
}

/**
 * Shared cancellation logic for both student and tutor.
 * Enforces the 24-hour rule, processes refund, cancels session.
 */
async function processCancellation(booking, cancelledBy) {
  const session = await CoachingSession.findByPk(booking.session_id);
  if (!session) {
    throw new ErrorClass("Associated coaching session not found", 404);
  }

  if (session.status === "ended") {
    throw new ErrorClass("Cannot cancel a completed session", 400);
  }

  if (session.status === "cancelled") {
    throw new ErrorClass("This session is already cancelled", 400);
  }

  // 24-hour rule: check time until session starts
  const now = new Date();
  const sessionStart = new Date(session.start_time);
  const timeUntilStart = sessionStart.getTime() - now.getTime();

  if (timeUntilStart < TWENTY_FOUR_HOURS_MS) {
    throw new ErrorClass(
      "Cannot cancel within 24 hours of the session start time. Cancellation is only allowed more than 24 hours before the session.",
      400
    );
  }

  const purchase = await CoachingSessionPurchase.findOne({
    where: { session_id: session.id, student_id: booking.student_id },
  });

  const dbTransaction = await db.transaction();

  try {
    // 1. Refund student wallet if payment was made
    if (purchase) {
      const student = await Students.findByPk(booking.student_id, {
        transaction: dbTransaction,
      });

      if (student) {
        const pricePaid = parseFloat(purchase.price_paid);
        const { balance: currentBalance } = await getWalletBalance(
          booking.student_id,
          true
        );
        const newBalance = currentBalance + pricePaid;
        const txRef = `REFUND-COACHING-BOOKING-${booking.id}-${Date.now()}`;
        const today = new Date().toISOString().split("T")[0];

        await Funding.create(
          {
            student_id: booking.student_id,
            amount: pricePaid,
            type: "Credit",
            service_name: "Coaching Session Cancellation Refund",
            ref: txRef,
            date: today,
            semester: null,
            academic_year: null,
            currency: purchase.currency,
            balance: newBalance.toString(),
          },
          { transaction: dbTransaction }
        );

        await student.update(
          { wallet_balance: newBalance },
          { transaction: dbTransaction }
        );
      }

      // 2. Reverse tutor earnings
      const tutorEarnings = parseFloat(purchase.tutor_earnings || 0);
      if (tutorEarnings > 0) {
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
          const newTotalEarnings = Math.max(
            0,
            parseFloat(tutor.total_earnings || 0) - tutorEarnings
          );
          await tutor.update(
            { total_earnings: newTotalEarnings },
            { transaction: dbTransaction }
          );
        }
      }

      // 3. Remove commission record
      const wspCommission = parseFloat(purchase.wsp_commission || 0);
      if (wspCommission > 0) {
        await WspCommission.destroy({
          where: { transaction_id: purchase.id },
          transaction: dbTransaction,
        });
      }
    }

    // 4. Refund tutor coaching hours
    const hoursReserved = parseFloat(session.hours_reserved || 0);
    if (hoursReserved > 0) {
      try {
        await refundHours(
          booking.tutor_id,
          booking.tutor_type,
          hoursReserved,
          dbTransaction
        );
      } catch (refundErr) {
        console.warn("Hours refund skipped:", refundErr.message);
      }
    }

    // 5. End Stream.io call if it exists
    if (session.stream_call_id) {
      try {
        await streamVideoService.endCall("default", session.stream_call_id);
      } catch (streamErr) {
        console.warn("Stream call cleanup skipped:", streamErr.message);
      }
    }

    // 6. Cancel the session
    await session.update({ status: "cancelled" }, { transaction: dbTransaction });

    // 7. Update the booking request
    await booking.update(
      {
        status: "cancelled",
        cancelled_at: new Date(),
      },
      { transaction: dbTransaction }
    );

    await dbTransaction.commit();

    return {
      booking_id: booking.id,
      session_id: session.id,
      status: "cancelled",
      cancelled_by: cancelledBy,
      refunded: !!purchase,
      refund_amount: purchase ? parseFloat(purchase.price_paid) : 0,
      refund_currency: purchase?.currency || null,
    };
  } catch (error) {
    await dbTransaction.rollback();
    throw error;
  }
}

/**
 * Cancel a booked session (student)
 * POST /api/marketplace/coaching/booking/:id/cancel-session
 * Auth: Student required
 * Rule: Only allowed more than 24 hours before session start
 */
export const studentCancelBookedSession = TryCatchFunction(async (req, res) => {
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

  if (!booking.session_id) {
    throw new ErrorClass(
      "No session has been created yet. Use the regular cancel endpoint instead.",
      400
    );
  }

  const result = await processCancellation(booking, "student");

  res.status(200).json({
    success: true,
    message: "Session cancelled and full refund processed to your wallet",
    data: result,
  });
});

/**
 * Cancel a booked session (tutor)
 * POST /api/marketplace/tutor/coaching/booking-requests/:id/cancel-session
 * Auth: Tutor required
 * Rule: Only allowed more than 24 hours before session start
 */
export const tutorCancelBookedSession = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const booking = await CoachingBookingRequest.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: "accepted",
    },
  });

  if (!booking) {
    throw new ErrorClass("No accepted booking found", 404);
  }

  if (!booking.session_id) {
    throw new ErrorClass(
      "No session has been created yet for this booking.",
      400
    );
  }

  const result = await processCancellation(booking, "tutor");

  res.status(200).json({
    success: true,
    message: "Session cancelled and student has been refunded",
    data: result,
  });
});
