import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TutorCoachingProfile } from "../../models/marketplace/tutorCoachingProfile.js";
import { TutorAvailability } from "../../models/marketplace/tutorAvailability.js";
import { CoachingBookingRequest } from "../../models/marketplace/coachingBookingRequest.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { Op, Sequelize } from "sequelize";

/**
 * Browse tutors who offer coaching (public or student)
 * GET /api/marketplace/coaching/tutors
 * Query: category, search, page, limit, min_price, max_price
 */
export const browseTutors = TryCatchFunction(async (req, res) => {
  const {
    category,
    search,
    page = 1,
    limit = 20,
    min_price,
    max_price,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const where = {
    is_accepting_bookings: true,
    hourly_rate: { [Op.gt]: 0 },
  };

  if (min_price) {
    where.hourly_rate = { ...where.hourly_rate, [Op.gte]: parseFloat(min_price) };
  }
  if (max_price) {
    where.hourly_rate = { ...where.hourly_rate, [Op.lte]: parseFloat(max_price) };
  }

  if (category) {
    where.specializations = {
      [Op.contains]: [category],
    };
  }

  const { count, rows: profiles } = await TutorCoachingProfile.findAndCountAll({
    where,
    include: [
      {
        model: SoleTutor,
        as: "soleTutor",
        attributes: ["id", "fname", "lname", "email", "profile_image", "slug"],
        required: false,
      },
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "email", "logo", "slug"],
        required: false,
      },
    ],
    order: [
      ["total_sessions_completed", "DESC"],
      ["average_rating", "DESC"],
    ],
    limit: limitNum,
    offset,
  });

  const filteredProfiles = profiles.filter((p) => {
    const tutor = p.tutor_type === "sole_tutor" ? p.soleTutor : p.organization;
    if (!tutor) return false;

    if (search && typeof search === "string" && search.trim()) {
      const term = search.trim().toLowerCase();
      const name =
        p.tutor_type === "sole_tutor"
          ? `${tutor.fname || ""} ${tutor.lname || ""}`.toLowerCase()
          : (tutor.name || "").toLowerCase();
      const bio = (p.bio || "").toLowerCase();
      return name.includes(term) || bio.includes(term);
    }
    return true;
  });

  const tutorsList = filteredProfiles.map((p) => {
    const tutor = p.tutor_type === "sole_tutor" ? p.soleTutor : p.organization;
    const tutorName =
      p.tutor_type === "sole_tutor"
        ? `${tutor.fname || ""} ${tutor.lname || ""}`.trim()
        : tutor.name || "";

    return {
      profile_id: p.id,
      tutor_id: p.tutor_id,
      tutor_type: p.tutor_type,
      tutor_name: tutorName,
      tutor_slug: tutor.slug || null,
      tutor_image:
        p.tutor_type === "sole_tutor"
          ? tutor.profile_image || null
          : tutor.logo || null,
      hourly_rate: parseFloat(p.hourly_rate),
      currency: p.currency,
      bio: p.bio,
      specializations: p.specializations || [],
      min_duration_minutes: p.min_duration_minutes,
      max_duration_minutes: p.max_duration_minutes,
      timezone: p.timezone,
      total_sessions_completed: p.total_sessions_completed,
      average_rating: p.average_rating ? parseFloat(p.average_rating) : null,
    };
  });

  res.status(200).json({
    success: true,
    data: {
      tutors: tutorsList,
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
 * Get a specific tutor's coaching profile + availability
 * GET /api/marketplace/coaching/tutors/:tutorId
 * Query: tutor_type (default "sole_tutor")
 */
export const getTutorCoachingDetails = TryCatchFunction(async (req, res) => {
  const { tutorId } = req.params;
  const tutorType = req.query.tutor_type || "sole_tutor";

  if (!["sole_tutor", "organization"].includes(tutorType)) {
    throw new ErrorClass("tutor_type must be sole_tutor or organization", 400);
  }

  const profile = await TutorCoachingProfile.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
    include: [
      {
        model: SoleTutor,
        as: "soleTutor",
        attributes: ["id", "fname", "lname", "email", "profile_image", "slug", "bio"],
        required: false,
      },
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "email", "logo", "slug", "description"],
        required: false,
      },
    ],
  });

  if (!profile) {
    throw new ErrorClass("Tutor coaching profile not found", 404);
  }

  if (!profile.is_accepting_bookings) {
    throw new ErrorClass("This tutor is not currently accepting bookings", 403);
  }

  const availability = await TutorAvailability.findAll({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      is_active: true,
    },
    order: [
      ["is_recurring", "DESC"],
      ["day_of_week", "ASC"],
      ["specific_date", "ASC"],
      ["start_time", "ASC"],
    ],
  });

  const tutor = tutorType === "sole_tutor" ? profile.soleTutor : profile.organization;
  const tutorName =
    tutorType === "sole_tutor"
      ? `${tutor?.fname || ""} ${tutor?.lname || ""}`.trim()
      : tutor?.name || "";

  res.status(200).json({
    success: true,
    data: {
      tutor: {
        id: profile.tutor_id,
        type: profile.tutor_type,
        name: tutorName,
        slug: tutor?.slug || null,
        image:
          tutorType === "sole_tutor"
            ? tutor?.profile_image || null
            : tutor?.logo || null,
        bio: tutor?.bio || tutor?.description || null,
      },
      coaching: {
        hourly_rate: parseFloat(profile.hourly_rate),
        currency: profile.currency,
        coaching_bio: profile.bio,
        specializations: profile.specializations || [],
        min_duration_minutes: profile.min_duration_minutes,
        max_duration_minutes: profile.max_duration_minutes,
        timezone: profile.timezone,
        total_sessions_completed: profile.total_sessions_completed,
        average_rating: profile.average_rating
          ? parseFloat(profile.average_rating)
          : null,
      },
      availability: {
        recurring: availability.filter((s) => s.is_recurring).map((s) => ({
          id: s.id,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          timezone: s.timezone,
        })),
        specific_dates: availability.filter((s) => !s.is_recurring).map((s) => ({
          id: s.id,
          date: s.specific_date,
          start_time: s.start_time,
          end_time: s.end_time,
          timezone: s.timezone,
        })),
      },
    },
  });
});

/**
 * Submit a booking request
 * POST /api/marketplace/coaching/booking-request
 * Auth: Student required
 */
export const createBookingRequest = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) {
    throw new ErrorClass("Authentication required", 401);
  }

  const {
    tutor_id,
    tutor_type = "sole_tutor",
    topic,
    description,
    category,
    proposed_start_time,
    proposed_end_time,
    duration_minutes,
    student_note,
  } = req.body;

  if (!tutor_id) throw new ErrorClass("tutor_id is required", 400);
  if (!topic || !topic.trim()) throw new ErrorClass("topic is required", 400);
  if (!proposed_start_time) throw new ErrorClass("proposed_start_time is required", 400);
  if (!proposed_end_time) throw new ErrorClass("proposed_end_time is required", 400);

  if (!["sole_tutor", "organization"].includes(tutor_type)) {
    throw new ErrorClass("tutor_type must be sole_tutor or organization", 400);
  }

  const profile = await TutorCoachingProfile.findOne({
    where: { tutor_id, tutor_type },
  });

  if (!profile) {
    throw new ErrorClass("Tutor coaching profile not found", 404);
  }

  if (!profile.is_accepting_bookings) {
    throw new ErrorClass("This tutor is not currently accepting bookings", 403);
  }

  const startTime = new Date(proposed_start_time);
  const endTime = new Date(proposed_end_time);
  const now = new Date();

  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    throw new ErrorClass("Invalid date format for proposed times", 400);
  }

  if (startTime <= now) {
    throw new ErrorClass("Proposed start time must be in the future", 400);
  }

  if (endTime <= startTime) {
    throw new ErrorClass("Proposed end time must be after start time", 400);
  }

  const calculatedDuration = Math.round((endTime - startTime) / (1000 * 60));
  const finalDuration = duration_minutes || calculatedDuration;

  if (finalDuration < profile.min_duration_minutes) {
    throw new ErrorClass(
      `Minimum session duration is ${profile.min_duration_minutes} minutes`,
      400
    );
  }

  if (finalDuration > profile.max_duration_minutes) {
    throw new ErrorClass(
      `Maximum session duration is ${profile.max_duration_minutes} minutes`,
      400
    );
  }

  // Check if student already has a pending/counter_proposed request with this tutor
  const existingRequest = await CoachingBookingRequest.findOne({
    where: {
      student_id: studentId,
      tutor_id,
      tutor_type,
      status: { [Op.in]: ["pending", "counter_proposed"] },
    },
  });

  if (existingRequest) {
    throw new ErrorClass(
      "You already have an active booking request with this tutor. Please wait for a response or cancel the existing request.",
      409
    );
  }

  // Determine if this is from the tutor's availability or a custom proposal
  let isFromAvailability = false;
  const startDate = startTime.toISOString().split("T")[0];
  const dayOfWeek = startTime.getDay();

  const matchingSlot = await TutorAvailability.findOne({
    where: {
      tutor_id,
      tutor_type,
      is_active: true,
      [Op.or]: [
        {
          is_recurring: true,
          day_of_week: dayOfWeek,
          start_time: { [Op.lte]: startTime.toTimeString().slice(0, 8) },
          end_time: { [Op.gte]: endTime.toTimeString().slice(0, 8) },
        },
        {
          is_recurring: false,
          specific_date: startDate,
          start_time: { [Op.lte]: startTime.toTimeString().slice(0, 8) },
          end_time: { [Op.gte]: endTime.toTimeString().slice(0, 8) },
        },
      ],
    },
  });

  if (matchingSlot) {
    isFromAvailability = true;
  }

  const hourlyRate = parseFloat(profile.hourly_rate);
  const estimatedPrice = Math.round(hourlyRate * (finalDuration / 60) * 100) / 100;

  // Set expiry to 48 hours from now for pending requests
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const booking = await CoachingBookingRequest.create({
    student_id: studentId,
    tutor_id,
    tutor_type,
    topic: topic.trim(),
    description: description?.trim() || null,
    category: category || null,
    proposed_start_time: startTime,
    proposed_end_time: endTime,
    proposed_duration_minutes: finalDuration,
    is_from_availability: isFromAvailability,
    status: "pending",
    hourly_rate: hourlyRate,
    estimated_price: estimatedPrice,
    currency: profile.currency,
    student_note: student_note?.trim() || null,
    expires_at: expiresAt,
  });

  res.status(201).json({
    success: true,
    message: isFromAvailability
      ? "Booking request submitted from tutor's available slot. Awaiting tutor confirmation."
      : "Booking request submitted with custom time proposal. Awaiting tutor response.",
    data: {
      booking: {
        id: booking.id,
        status: booking.status,
        topic: booking.topic,
        proposed_start_time: booking.proposed_start_time,
        proposed_end_time: booking.proposed_end_time,
        proposed_duration_minutes: booking.proposed_duration_minutes,
        is_from_availability: booking.is_from_availability,
        hourly_rate: parseFloat(booking.hourly_rate),
        estimated_price: parseFloat(booking.estimated_price),
        currency: booking.currency,
        expires_at: booking.expires_at,
      },
    },
  });
});

/**
 * Get student's booking requests
 * GET /api/marketplace/coaching/my-booking-requests
 * Auth: Student required
 * Query: status, page, limit
 */
export const getMyBookingRequests = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) {
    throw new ErrorClass("Authentication required", 401);
  }

  const { status, page = 1, limit = 20 } = req.query;

  const where = { student_id: studentId };
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
        model: SoleTutor,
        as: "soleTutor",
        attributes: ["id", "fname", "lname", "profile_image", "slug"],
        required: false,
      },
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "logo", "slug"],
        required: false,
      },
    ],
    order: [["created_at", "DESC"]],
    limit: limitNum,
    offset,
  });

  const bookingsList = requests.map((r) => {
    const tutor = r.tutor_type === "sole_tutor" ? r.soleTutor : r.organization;
    const tutorName =
      r.tutor_type === "sole_tutor"
        ? `${tutor?.fname || ""} ${tutor?.lname || ""}`.trim()
        : tutor?.name || "";

    return {
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
      tutor: {
        id: r.tutor_id,
        type: r.tutor_type,
        name: tutorName,
        image:
          r.tutor_type === "sole_tutor"
            ? tutor?.profile_image || null
            : tutor?.logo || null,
        slug: tutor?.slug || null,
      },
      created_at: r.created_at,
    };
  });

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
 * Cancel a booking request (student)
 * POST /api/marketplace/coaching/booking-request/:id/cancel
 * Auth: Student required
 */
export const cancelBookingRequest = TryCatchFunction(async (req, res) => {
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

  if (!["pending", "counter_proposed"].includes(booking.status)) {
    throw new ErrorClass(
      `Cannot cancel a booking that is already ${booking.status}`,
      400
    );
  }

  booking.status = "cancelled";
  booking.cancelled_at = new Date();
  await booking.save();

  res.status(200).json({
    success: true,
    message: "Booking request cancelled",
    data: { booking_id: booking.id, status: booking.status },
  });
});
