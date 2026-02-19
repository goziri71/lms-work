import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TutorCoachingProfile } from "../../models/marketplace/tutorCoachingProfile.js";
import { TutorAvailability } from "../../models/marketplace/tutorAvailability.js";
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
// COACHING PROFILE
// ============================================

/**
 * Get or create coaching profile
 * GET /api/marketplace/tutor/coaching/profile
 */
export const getCoachingProfile = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);

  let profile = await TutorCoachingProfile.findOne({
    where: { tutor_id: tutorId, tutor_type: tutorType },
  });

  if (!profile) {
    profile = await TutorCoachingProfile.create({
      tutor_id: tutorId,
      tutor_type: tutorType,
    });
  }

  res.status(200).json({
    success: true,
    data: { profile },
  });
});

/**
 * Update coaching profile
 * PUT /api/marketplace/tutor/coaching/profile
 */
export const updateCoachingProfile = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const {
    hourly_rate,
    currency,
    bio,
    specializations,
    is_accepting_bookings,
    min_duration_minutes,
    max_duration_minutes,
    timezone,
  } = req.body;

  let profile = await TutorCoachingProfile.findOne({
    where: { tutor_id: tutorId, tutor_type: tutorType },
  });

  if (!profile) {
    profile = await TutorCoachingProfile.create({
      tutor_id: tutorId,
      tutor_type: tutorType,
    });
  }

  if (hourly_rate !== undefined) {
    if (isNaN(hourly_rate) || Number(hourly_rate) < 0) {
      throw new ErrorClass("Hourly rate must be a non-negative number", 400);
    }
    profile.hourly_rate = hourly_rate;
  }

  if (currency !== undefined) {
    profile.currency = currency.toUpperCase();
  }

  if (bio !== undefined) {
    profile.bio = bio;
  }

  if (specializations !== undefined) {
    if (!Array.isArray(specializations)) {
      throw new ErrorClass("Specializations must be an array", 400);
    }
    profile.specializations = specializations;
  }

  if (is_accepting_bookings !== undefined) {
    profile.is_accepting_bookings = Boolean(is_accepting_bookings);
  }

  if (min_duration_minutes !== undefined) {
    if (!Number.isInteger(min_duration_minutes) || min_duration_minutes < 15) {
      throw new ErrorClass("Minimum duration must be at least 15 minutes", 400);
    }
    profile.min_duration_minutes = min_duration_minutes;
  }

  if (max_duration_minutes !== undefined) {
    if (!Number.isInteger(max_duration_minutes) || max_duration_minutes < 30) {
      throw new ErrorClass("Maximum duration must be at least 30 minutes", 400);
    }
    profile.max_duration_minutes = max_duration_minutes;
  }

  if (
    profile.min_duration_minutes &&
    profile.max_duration_minutes &&
    profile.min_duration_minutes > profile.max_duration_minutes
  ) {
    throw new ErrorClass(
      "Minimum duration cannot be greater than maximum duration",
      400
    );
  }

  if (timezone !== undefined) {
    profile.timezone = timezone;
  }

  await profile.save();

  res.status(200).json({
    success: true,
    message: "Coaching profile updated successfully",
    data: { profile },
  });
});

// ============================================
// AVAILABILITY MANAGEMENT
// ============================================

/**
 * Get all availability slots
 * GET /api/marketplace/tutor/coaching/availability
 */
export const getAvailability = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);

  const slots = await TutorAvailability.findAll({
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

  const recurring = slots.filter((s) => s.is_recurring);
  const specific = slots.filter((s) => !s.is_recurring);

  res.status(200).json({
    success: true,
    data: {
      recurring,
      specific,
      total: slots.length,
    },
  });
});

/**
 * Add availability slot(s)
 * POST /api/marketplace/tutor/coaching/availability
 * Body: { slots: [{ is_recurring, day_of_week?, specific_date?, start_time, end_time, timezone? }] }
 */
export const addAvailability = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { slots } = req.body;

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    throw new ErrorClass("Please provide at least one availability slot", 400);
  }

  if (slots.length > 20) {
    throw new ErrorClass("Cannot add more than 20 slots at once", 400);
  }

  const profile = await TutorCoachingProfile.findOne({
    where: { tutor_id: tutorId, tutor_type: tutorType },
  });

  const defaultTimezone = profile?.timezone || "Africa/Lagos";
  const createdSlots = [];

  for (const slot of slots) {
    const { is_recurring, day_of_week, specific_date, start_time, end_time, timezone } = slot;

    if (!start_time || !end_time) {
      throw new ErrorClass("start_time and end_time are required for each slot", 400);
    }

    if (start_time >= end_time) {
      throw new ErrorClass(
        `start_time (${start_time}) must be before end_time (${end_time})`,
        400
      );
    }

    if (is_recurring) {
      if (day_of_week === undefined || day_of_week === null) {
        throw new ErrorClass("day_of_week is required for recurring slots", 400);
      }
      if (!Number.isInteger(day_of_week) || day_of_week < 0 || day_of_week > 6) {
        throw new ErrorClass("day_of_week must be 0 (Sunday) to 6 (Saturday)", 400);
      }

      const existingOverlap = await TutorAvailability.findOne({
        where: {
          tutor_id: tutorId,
          tutor_type: tutorType,
          is_recurring: true,
          day_of_week,
          is_active: true,
          [Op.or]: [
            {
              start_time: { [Op.lt]: end_time },
              end_time: { [Op.gt]: start_time },
            },
          ],
        },
      });

      if (existingOverlap) {
        throw new ErrorClass(
          `Overlapping recurring slot exists for day ${day_of_week} (${existingOverlap.start_time} - ${existingOverlap.end_time})`,
          409
        );
      }
    } else {
      if (!specific_date) {
        throw new ErrorClass("specific_date is required for non-recurring slots", 400);
      }

      const slotDate = new Date(specific_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (slotDate < today) {
        throw new ErrorClass("specific_date cannot be in the past", 400);
      }

      const existingOverlap = await TutorAvailability.findOne({
        where: {
          tutor_id: tutorId,
          tutor_type: tutorType,
          is_recurring: false,
          specific_date,
          is_active: true,
          [Op.or]: [
            {
              start_time: { [Op.lt]: end_time },
              end_time: { [Op.gt]: start_time },
            },
          ],
        },
      });

      if (existingOverlap) {
        throw new ErrorClass(
          `Overlapping slot exists for ${specific_date} (${existingOverlap.start_time} - ${existingOverlap.end_time})`,
          409
        );
      }
    }

    const created = await TutorAvailability.create({
      tutor_id: tutorId,
      tutor_type: tutorType,
      is_recurring: Boolean(is_recurring),
      day_of_week: is_recurring ? day_of_week : null,
      specific_date: is_recurring ? null : specific_date,
      start_time,
      end_time,
      timezone: timezone || defaultTimezone,
      is_active: true,
    });

    createdSlots.push(created);
  }

  res.status(201).json({
    success: true,
    message: `${createdSlots.length} availability slot(s) added`,
    data: { slots: createdSlots },
  });
});

/**
 * Update a single availability slot
 * PUT /api/marketplace/tutor/coaching/availability/:slotId
 */
export const updateAvailability = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { slotId } = req.params;
  const { start_time, end_time, timezone, is_active } = req.body;

  const slot = await TutorAvailability.findOne({
    where: { id: slotId, tutor_id: tutorId, tutor_type: tutorType },
  });

  if (!slot) {
    throw new ErrorClass("Availability slot not found", 404);
  }

  if (start_time !== undefined) slot.start_time = start_time;
  if (end_time !== undefined) slot.end_time = end_time;
  if (timezone !== undefined) slot.timezone = timezone;
  if (is_active !== undefined) slot.is_active = Boolean(is_active);

  if (slot.start_time >= slot.end_time) {
    throw new ErrorClass("start_time must be before end_time", 400);
  }

  await slot.save();

  res.status(200).json({
    success: true,
    message: "Availability slot updated",
    data: { slot },
  });
});

/**
 * Delete an availability slot
 * DELETE /api/marketplace/tutor/coaching/availability/:slotId
 */
export const deleteAvailability = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { slotId } = req.params;

  const slot = await TutorAvailability.findOne({
    where: { id: slotId, tutor_id: tutorId, tutor_type: tutorType },
  });

  if (!slot) {
    throw new ErrorClass("Availability slot not found", 404);
  }

  await slot.destroy();

  res.status(200).json({
    success: true,
    message: "Availability slot deleted",
  });
});

/**
 * Bulk delete availability (e.g., clear all recurring for a day)
 * DELETE /api/marketplace/tutor/coaching/availability
 * Body: { slot_ids: [1, 2, 3] }
 */
export const bulkDeleteAvailability = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { slot_ids } = req.body;

  if (!slot_ids || !Array.isArray(slot_ids) || slot_ids.length === 0) {
    throw new ErrorClass("Please provide slot_ids array", 400);
  }

  const deleted = await TutorAvailability.destroy({
    where: {
      id: { [Op.in]: slot_ids },
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  res.status(200).json({
    success: true,
    message: `${deleted} availability slot(s) deleted`,
  });
});
