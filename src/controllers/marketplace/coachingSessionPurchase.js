import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CoachingSession } from "../../models/marketplace/coachingSession.js";
import { CoachingSessionPurchase } from "../../models/marketplace/coachingSessionPurchase.js";
import { Students } from "../../models/auth/student.js";
import { Funding } from "../../models/payment/funding.js";
import { GeneralSetup } from "../../models/settings/generalSetup.js";
import { getWalletBalance } from "../../services/walletBalanceService.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { WspCommission } from "../../models/marketplace/wspCommission.js";
import { db } from "../../database/database.js";

/**
 * Purchase access to a paid coaching session
 * POST /api/marketplace/coaching/sessions/:id/purchase
 * Auth: Student only
 */
export const purchaseSessionAccess = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can purchase coaching sessions", 403);
  }

  // Get session
  const session = await CoachingSession.findByPk(id);
  if (!session) {
    throw new ErrorClass("Coaching session not found", 404);
  }

  // Check if session is paid
  if (session.pricing_type !== "paid") {
    throw new ErrorClass("This session is free. No purchase required.", 400);
  }

  // Check if session is still available (not ended or cancelled)
  if (session.status === "ended" || session.status === "cancelled") {
    throw new ErrorClass("This session is no longer available", 400);
  }

  // Check if session has already started or is within 10 minutes of start time
  const now = new Date();
  const startTime = new Date(session.start_time);
  const timeUntilStart = startTime.getTime() - now.getTime();
  const tenMinutesInMs = 10 * 60 * 1000; // 10 minutes in milliseconds

  if (timeUntilStart <= 0) {
    // Session has already started
    if (session.status === "active") {
      throw new ErrorClass("This coaching session is currently in progress. You cannot purchase access to an ongoing session.", 400);
    } else {
      throw new ErrorClass("This session has already started. You cannot purchase access to past sessions.", 400);
    }
  }

  if (timeUntilStart <= tenMinutesInMs) {
    // Session starts within 10 minutes
    throw new ErrorClass("This coaching session is about to start. Purchase is no longer available. Please purchase at least 10 minutes before the session starts.", 400);
  }

  // Check if already purchased
  const existingPurchase = await CoachingSessionPurchase.findOne({
    where: {
      session_id: id,
      student_id: studentId,
    },
  });

  if (existingPurchase) {
    throw new ErrorClass("You have already purchased access to this session", 400);
  }

  // Verify student exists
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get exchange rate
  const generalSetup = await GeneralSetup.findOne({
    order: [["id", "DESC"]],
  });
  const exchangeRate = parseFloat(generalSetup?.rate || "1500");

  // Get currencies
  const sessionCurrency = (session.currency || "NGN").toUpperCase();
  const studentCurrency = (student.currency || "NGN").toUpperCase();
  const sessionPrice = parseFloat(session.price);

  // Convert price to student's currency if needed
  let priceInStudentCurrency = sessionPrice;
  if (sessionCurrency !== studentCurrency) {
    if (sessionCurrency === "USD" && studentCurrency === "NGN") {
      priceInStudentCurrency = sessionPrice * exchangeRate;
    } else if (sessionCurrency === "NGN" && studentCurrency === "USD") {
      priceInStudentCurrency = sessionPrice / exchangeRate;
    }
  }

  // Check wallet balance
  const { balance: walletBalance } = await getWalletBalance(studentId, true);

  if (walletBalance < priceInStudentCurrency) {
    let requiredDisplay;
    if (sessionCurrency !== studentCurrency) {
      requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency} (${sessionPrice} ${sessionCurrency})`;
    } else {
      requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency}`;
    }

    throw new ErrorClass(
      `Insufficient wallet balance. Required: ${requiredDisplay}, Available: ${walletBalance.toFixed(2)} ${studentCurrency}. Please fund your wallet first.`,
      400
    );
  }

  // Get commission rate (from session, separate from course commission)
  const commissionRate = parseFloat(session.commission_rate || 15.0);
  const wspCommission = (priceInStudentCurrency * commissionRate) / 100;
  const tutorEarnings = priceInStudentCurrency - wspCommission;

  // Generate transaction reference
  const txRef = `COACHING-SESSION-${id}-${Date.now()}`;
  const today = new Date().toISOString().split("T")[0];

  // Use transaction
  const transaction = await db.transaction();

  try {
    // Debit wallet
    const newBalance = walletBalance - priceInStudentCurrency;

    await Funding.create(
      {
        student_id: studentId,
        amount: priceInStudentCurrency,
        type: "Debit",
        service_name: "Coaching Session Purchase",
        ref: txRef,
        date: today,
        semester: null,
        academic_year: null,
        currency: studentCurrency,
        balance: newBalance.toString(),
      },
      { transaction }
    );

    // Update student wallet
    await student.update({ wallet_balance: newBalance }, { transaction });

    // Create purchase record
    const purchase = await CoachingSessionPurchase.create(
      {
        session_id: id,
        student_id: studentId,
        price_paid: priceInStudentCurrency,
        currency: studentCurrency,
        commission_rate: commissionRate,
        wsp_commission: wspCommission,
        tutor_earnings: tutorEarnings,
        transaction_ref: txRef,
        payment_method: "wallet",
      },
      { transaction }
    );

    // Create WPU commission record (only if there's commission to record)
    if (wspCommission > 0) {
      await WspCommission.create(
        {
          transaction_id: purchase.id,
          amount: wspCommission,
          currency: studentCurrency,
          status: "collected",
          collected_at: new Date(),
        },
        { transaction }
      );
    }

    // Update tutor earnings
    let tutor;
    if (session.tutor_type === "sole_tutor") {
      tutor = await SoleTutor.findByPk(session.tutor_id, { transaction });
    } else {
      tutor = await Organization.findByPk(session.tutor_id, { transaction });
    }

    if (tutor) {
      const newTotalEarnings = parseFloat(tutor.total_earnings || 0) + tutorEarnings;
      await tutor.update({ total_earnings: newTotalEarnings }, { transaction });
    }

    // Add student as participant if not already invited
    const { CoachingParticipant } = await import("../../models/marketplace/coachingParticipant.js");
    const existingParticipant = await CoachingParticipant.findOne({
      where: {
        session_id: id,
        student_id: studentId,
      },
      transaction,
    });

    if (!existingParticipant) {
      await CoachingParticipant.create(
        {
          session_id: id,
          student_id: studentId,
          email_sent: false,
        },
        { transaction }
      );

      // Update student count
      await session.update(
        {
          student_count: session.student_count + 1,
        },
        { transaction }
      );
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Coaching session access purchased successfully",
      data: {
        purchase_id: purchase.id,
        session_id: id,
        price_paid: priceInStudentCurrency,
        currency: studentCurrency,
        transaction_ref: txRef,
        new_wallet_balance: newBalance,
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Check if student has purchased access to a session
 * Internal helper function
 */
export async function hasPurchasedAccess(sessionId, studentId) {
  if (!sessionId || !studentId) {
    return false;
  }

  const purchase = await CoachingSessionPurchase.findOne({
    where: {
      session_id: sessionId,
      student_id: studentId,
    },
  });

  return !!purchase;
}

