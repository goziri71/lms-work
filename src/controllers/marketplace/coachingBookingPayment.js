import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CoachingBookingRequest } from "../../models/marketplace/coachingBookingRequest.js";
import { Students } from "../../models/auth/student.js";
import { GeneralSetup } from "../../models/settings/generalSetup.js";
import { getWalletBalance } from "../../services/walletBalanceService.js";
import {
  buildBookingTxRef,
  fulfillAcceptedBookingPayment,
  getAgreedBookingTimes,
  assertBookingPayable,
} from "../../services/coachingBookingFulfillmentService.js";

/**
 * Process payment and create session after booking is accepted (wallet).
 * POST /api/marketplace/coaching/booking/:id/process-payment
 * Auth: Student required
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

  await assertBookingPayable(booking);

  const txRef = buildBookingTxRef(id);
  const result = await fulfillAcceptedBookingPayment(booking.id, {
    paymentMethod: "wallet",
    txRef,
    payerStudentId: studentId,
  });

  const student = await Students.findByPk(studentId);

  res.status(201).json({
    success: true,
    message: "Payment processed and coaching session created successfully",
    data: {
      booking_id: booking.id,
      session_id: result.session.id,
      stream_call_id: result.stream_call_id,
      view_link: result.view_link,
      price_paid: parseFloat(result.purchase.price_paid),
      currency: result.purchase.currency,
      transaction_ref: txRef,
      new_wallet_balance: parseFloat(student?.wallet_balance || 0),
      session: {
        id: result.session.id,
        title: result.session.title,
        start_time: result.session.start_time,
        end_time: result.session.end_time,
        duration_minutes: result.session.duration_minutes,
        status: result.session.status,
      },
    },
  });
});

/**
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

  const { startTime, endTime, durationMinutes } = getAgreedBookingTimes(booking);

  const commissionRate = 15.0;
  const platformFee = (priceInStudentCurrency * commissionRate) / 100;

  res.status(200).json({
    success: true,
    data: {
      booking_id: booking.id,
      topic: booking.topic,
      agreed_start_time: startTime,
      agreed_end_time: endTime,
      agreed_duration_minutes: durationMinutes,
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
      access_token: booking.access_token,
    },
  });
});
