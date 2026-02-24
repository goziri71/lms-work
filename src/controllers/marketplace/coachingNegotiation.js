import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CoachingBookingRequest } from "../../models/marketplace/coachingBookingRequest.js";
import { TutorCoachingProfile } from "../../models/marketplace/tutorCoachingProfile.js";
import { Students } from "../../models/auth/student.js";
import { Op } from "sequelize";

function getTutorInfo(req) {
  if (!req.user) {
    throw new ErrorClass("User not authenticated", 401);
  }
  if (!req.tutor) {
    throw new ErrorClass("Tutor information not found", 403);
  }

  const userType = req.user.userType;
  let tutorId, tutorType, tutorName;

  if (userType === "sole_tutor") {
    tutorId = req.tutor.id;
    tutorType = "sole_tutor";
    tutorName = `${req.tutor.fname} ${req.tutor.lname}`;
  } else if (userType === "organization") {
    tutorId = req.tutor.id;
    tutorType = "organization";
    tutorName = req.tutor.name;
  } else if (userType === "organization_user") {
    tutorId = req.tutor.organization_id;
    tutorType = "organization";
    tutorName =
      req.tutor.organization?.name || `${req.tutor.fname} ${req.tutor.lname}`;
  } else {
    throw new ErrorClass("Invalid user type", 403);
  }

  return { tutorId, tutorType, tutorName };
}

// ============================================
// TUTOR: VIEW BOOKING REQUESTS
// ============================================

/**
 * Get all booking requests for this tutor
 * GET /api/marketplace/tutor/coaching/booking-requests
 * Query: status, page, limit
 */
export const getTutorBookingRequests = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { status, page = 1, limit = 20 } = req.query;

  const where = { tutor_id: tutorId, tutor_type: tutorType };
  if (status) {
    where.status = status;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const { count, rows: requests } = await CoachingBookingRequest.findAndCountAll({
    where,
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "email", "profile_image"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit: limitNum,
    offset,
  });

  const bookingsList = requests.map((r) => ({
    id: r.id,
    status: r.status,
    topic: r.topic,
    description: r.description,
    category: r.category,
    proposed_start_time: r.proposed_start_time,
    proposed_end_time: r.proposed_end_time,
    proposed_duration_minutes: r.proposed_duration_minutes,
    is_from_availability: r.is_from_availability,
    counter_proposed_start_time: r.counter_proposed_start_time,
    counter_proposed_end_time: r.counter_proposed_end_time,
    counter_proposed_duration_minutes: r.counter_proposed_duration_minutes,
    hourly_rate: parseFloat(r.hourly_rate),
    estimated_price: parseFloat(r.estimated_price),
    final_price: r.final_price ? parseFloat(r.final_price) : null,
    currency: r.currency,
    student_note: r.student_note,
    tutor_note: r.tutor_note,
    session_id: r.session_id,
    expires_at: r.expires_at,
    accepted_at: r.accepted_at,
    student: r.student
      ? {
          id: r.student.id,
          name: `${r.student.fname || ""} ${r.student.lname || ""}`.trim(),
          email: r.student.email,
          image: r.student.profile_image || null,
        }
      : null,
    created_at: r.created_at,
  }));

  res.status(200).json({
    success: true,
    data: {
      bookings: bookingsList,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(count / limitNum),
      },
    },
  });
});

/**
 * Get a single booking request detail (tutor view)
 * GET /api/marketplace/tutor/coaching/booking-requests/:id
 */
export const getTutorBookingRequestDetail = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const booking = await CoachingBookingRequest.findOne({
    where: { id, tutor_id: tutorId, tutor_type: tutorType },
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "email", "profile_image"],
      },
    ],
  });

  if (!booking) {
    throw new ErrorClass("Booking request not found", 404);
  }

  res.status(200).json({
    success: true,
    data: { booking },
  });
});

// ============================================
// TUTOR: ACCEPT BOOKING
// ============================================

/**
 * Accept a booking request (tutor)
 * POST /api/marketplace/tutor/coaching/booking-requests/:id/accept
 * Body: { tutor_note? }
 */
export const acceptBookingRequest = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;
  const { tutor_note } = req.body;

  const booking = await CoachingBookingRequest.findOne({
    where: { id, tutor_id: tutorId, tutor_type: tutorType },
  });

  if (!booking) {
    throw new ErrorClass("Booking request not found", 404);
  }

  if (booking.status !== "pending") {
    throw new ErrorClass(
      `Cannot accept a booking that is ${booking.status}. Only pending requests can be accepted.`,
      400
    );
  }

  if (booking.expires_at && new Date(booking.expires_at) < new Date()) {
    booking.status = "expired";
    await booking.save();
    throw new ErrorClass("This booking request has expired", 410);
  }

  const startTime = new Date(booking.proposed_start_time);
  if (startTime <= new Date()) {
    throw new ErrorClass("The proposed time has already passed", 400);
  }

  const hourlyRate = parseFloat(booking.hourly_rate);
  const duration = booking.proposed_duration_minutes;
  const finalPrice = Math.round(hourlyRate * (duration / 60) * 100) / 100;

  booking.status = "accepted";
  booking.accepted_by = "tutor";
  booking.accepted_at = new Date();
  booking.final_price = finalPrice;
  if (tutor_note) booking.tutor_note = tutor_note.trim();
  await booking.save();

  res.status(200).json({
    success: true,
    message: "Booking request accepted. Payment will be processed and session will be created.",
    data: {
      booking_id: booking.id,
      status: booking.status,
      final_price: parseFloat(booking.final_price),
      currency: booking.currency,
      proposed_start_time: booking.proposed_start_time,
      proposed_end_time: booking.proposed_end_time,
      proposed_duration_minutes: booking.proposed_duration_minutes,
    },
  });
});

// ============================================
// TUTOR: DECLINE BOOKING
// ============================================

/**
 * Decline a booking request (tutor)
 * POST /api/marketplace/tutor/coaching/booking-requests/:id/decline
 * Body: { tutor_note? }
 */
export const declineBookingRequest = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;
  const { tutor_note } = req.body;

  const booking = await CoachingBookingRequest.findOne({
    where: { id, tutor_id: tutorId, tutor_type: tutorType },
  });

  if (!booking) {
    throw new ErrorClass("Booking request not found", 404);
  }

  if (!["pending", "counter_proposed"].includes(booking.status)) {
    throw new ErrorClass(
      `Cannot decline a booking that is ${booking.status}`,
      400
    );
  }

  booking.status = "declined";
  booking.declined_at = new Date();
  if (tutor_note) booking.tutor_note = tutor_note.trim();
  await booking.save();

  res.status(200).json({
    success: true,
    message: "Booking request declined",
    data: { booking_id: booking.id, status: booking.status },
  });
});

// ============================================
// TUTOR: COUNTER-PROPOSE A TIME
// ============================================

/**
 * Counter-propose a different time (tutor)
 * POST /api/marketplace/tutor/coaching/booking-requests/:id/counter
 * Body: { counter_start_time, counter_end_time, tutor_note? }
 */
export const counterProposeBooking = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;
  const { counter_start_time, counter_end_time, tutor_note } = req.body;

  if (!counter_start_time || !counter_end_time) {
    throw new ErrorClass(
      "counter_start_time and counter_end_time are required",
      400
    );
  }

  const booking = await CoachingBookingRequest.findOne({
    where: { id, tutor_id: tutorId, tutor_type: tutorType },
  });

  if (!booking) {
    throw new ErrorClass("Booking request not found", 404);
  }

  if (booking.status !== "pending") {
    throw new ErrorClass(
      `Cannot counter-propose on a booking that is ${booking.status}. Only pending requests can receive a counter-proposal.`,
      400
    );
  }

  if (booking.expires_at && new Date(booking.expires_at) < new Date()) {
    booking.status = "expired";
    await booking.save();
    throw new ErrorClass("This booking request has expired", 410);
  }

  const startTime = new Date(counter_start_time);
  const endTime = new Date(counter_end_time);
  const now = new Date();

  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    throw new ErrorClass("Invalid date format for counter-proposed times", 400);
  }

  if (startTime <= now) {
    throw new ErrorClass("Counter-proposed start time must be in the future", 400);
  }

  if (endTime <= startTime) {
    throw new ErrorClass("Counter-proposed end time must be after start time", 400);
  }

  const counterDuration = Math.round((endTime - startTime) / (1000 * 60));

  const profile = await TutorCoachingProfile.findOne({
    where: { tutor_id: tutorId, tutor_type: tutorType },
  });

  if (profile) {
    if (counterDuration < profile.min_duration_minutes) {
      throw new ErrorClass(
        `Counter-proposed duration (${counterDuration}min) is below your minimum (${profile.min_duration_minutes}min)`,
        400
      );
    }
    if (counterDuration > profile.max_duration_minutes) {
      throw new ErrorClass(
        `Counter-proposed duration (${counterDuration}min) exceeds your maximum (${profile.max_duration_minutes}min)`,
        400
      );
    }
  }

  const hourlyRate = parseFloat(booking.hourly_rate);
  const newEstimatedPrice = Math.round(hourlyRate * (counterDuration / 60) * 100) / 100;

  booking.counter_proposed_start_time = startTime;
  booking.counter_proposed_end_time = endTime;
  booking.counter_proposed_duration_minutes = counterDuration;
  booking.status = "counter_proposed";
  booking.estimated_price = newEstimatedPrice;
  if (tutor_note) booking.tutor_note = tutor_note.trim();

  // Reset expiry to 48 hours from now for the student to respond
  booking.expires_at = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  await booking.save();

  res.status(200).json({
    success: true,
    message: "Counter-proposal sent to student. Awaiting their response.",
    data: {
      booking_id: booking.id,
      status: booking.status,
      counter_proposed_start_time: booking.counter_proposed_start_time,
      counter_proposed_end_time: booking.counter_proposed_end_time,
      counter_proposed_duration_minutes: booking.counter_proposed_duration_minutes,
      estimated_price: parseFloat(booking.estimated_price),
      currency: booking.currency,
      expires_at: booking.expires_at,
    },
  });
});

// ============================================
// STUDENT: ACCEPT COUNTER-PROPOSAL
// ============================================

/**
 * Accept a tutor's counter-proposal (student)
 * POST /api/marketplace/coaching/booking-request/:id/accept-counter
 * Auth: Student required
 */
export const acceptCounterProposal = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) {
    throw new ErrorClass("Authentication required", 401);
  }

  const { id } = req.params;

  const booking = await CoachingBookingRequest.findOne({
    where: { id, student_id: studentId },
  });

  if (!booking) {
    throw new ErrorClass("Booking request not found", 404);
  }

  if (booking.status !== "counter_proposed") {
    throw new ErrorClass(
      `Cannot accept counter-proposal on a booking that is ${booking.status}`,
      400
    );
  }

  if (booking.expires_at && new Date(booking.expires_at) < new Date()) {
    booking.status = "expired";
    await booking.save();
    throw new ErrorClass("This counter-proposal has expired", 410);
  }

  const startTime = new Date(booking.counter_proposed_start_time);
  if (startTime <= new Date()) {
    throw new ErrorClass("The counter-proposed time has already passed", 400);
  }

  const hourlyRate = parseFloat(booking.hourly_rate);
  const duration = booking.counter_proposed_duration_minutes;
  const finalPrice = Math.round(hourlyRate * (duration / 60) * 100) / 100;

  booking.status = "accepted";
  booking.accepted_by = "student";
  booking.accepted_at = new Date();
  booking.final_price = finalPrice;
  await booking.save();

  res.status(200).json({
    success: true,
    message: "Counter-proposal accepted. Payment will be processed and session will be created.",
    data: {
      booking_id: booking.id,
      status: booking.status,
      final_price: parseFloat(booking.final_price),
      currency: booking.currency,
      start_time: booking.counter_proposed_start_time,
      end_time: booking.counter_proposed_end_time,
      duration_minutes: booking.counter_proposed_duration_minutes,
    },
  });
});

/**
 * Decline a tutor's counter-proposal (student)
 * POST /api/marketplace/coaching/booking-request/:id/decline-counter
 * Auth: Student required
 */
export const declineCounterProposal = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) {
    throw new ErrorClass("Authentication required", 401);
  }

  const { id } = req.params;
  const { student_note } = req.body;

  const booking = await CoachingBookingRequest.findOne({
    where: { id, student_id: studentId },
  });

  if (!booking) {
    throw new ErrorClass("Booking request not found", 404);
  }

  if (booking.status !== "counter_proposed") {
    throw new ErrorClass(
      `Cannot decline counter-proposal on a booking that is ${booking.status}`,
      400
    );
  }

  booking.status = "declined";
  booking.declined_at = new Date();
  if (student_note) booking.student_note = student_note.trim();
  await booking.save();

  res.status(200).json({
    success: true,
    message: "Counter-proposal declined. The booking request is now closed.",
    data: { booking_id: booking.id, status: booking.status },
  });
});
