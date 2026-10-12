import { Op } from "sequelize";
import { ErrorClass } from "../utils/errorClass/index.js";
import { CoachingCalendarHold } from "../models/marketplace/coachingCalendarHold.js";
import { CoachingBookingRequest } from "../models/marketplace/coachingBookingRequest.js";
import { CoachingSession } from "../models/marketplace/coachingSession.js";
import { TutorAvailability } from "../models/marketplace/tutorAvailability.js";
import { getAgreedBookingTimes } from "../utils/coachingBookingTimes.js";

export function intervalsOverlap(startA, endA, startB, endB) {
  return new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB);
}

/**
 * Active blocks: calendar holds, accepted-unpaid bookings, scheduled sessions.
 */
export async function listTutorUnavailableIntervals(
  tutorId,
  tutorType,
  { from, to, transaction } = {}
) {
  const now = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const until = to
    ? new Date(to)
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const holds = await CoachingCalendarHold.findAll({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: "active",
      start_time: { [Op.lt]: until },
      end_time: { [Op.gt]: now },
    },
    transaction,
  });

  const acceptedBookings = await CoachingBookingRequest.findAll({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: "accepted",
      session_id: null,
      expires_at: { [Op.gt]: new Date() },
    },
    transaction,
  });

  const sessions = await CoachingSession.findAll({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: { [Op.in]: ["scheduled", "active"] },
      start_time: { [Op.lt]: until },
      end_time: { [Op.gt]: now },
    },
    attributes: ["id", "start_time", "end_time", "title", "status"],
    transaction,
  });

  const intervals = [];

  for (const h of holds) {
    intervals.push({
      source: "calendar_hold",
      booking_request_id: h.booking_request_id,
      start_time: h.start_time,
      end_time: h.end_time,
    });
  }

  for (const b of acceptedBookings) {
    const { startTime, endTime } = getAgreedBookingTimes(b);
    if (startTime < until && endTime > now) {
      intervals.push({
        source: "accepted_booking",
        booking_request_id: b.id,
        start_time: startTime,
        end_time: endTime,
      });
    }
  }

  for (const s of sessions) {
    intervals.push({
      source: "coaching_session",
      session_id: s.id,
      start_time: s.start_time,
      end_time: s.end_time,
      title: s.title,
    });
  }

  return intervals;
}

export async function assertTutorSlotAvailable(
  tutorId,
  tutorType,
  startTime,
  endTime,
  { excludeBookingId, transaction } = {}
) {
  const intervals = await listTutorUnavailableIntervals(tutorId, tutorType, {
    transaction,
  });

  for (const block of intervals) {
    if (
      excludeBookingId &&
      block.booking_request_id === excludeBookingId
    ) {
      continue;
    }
    if (intervalsOverlap(startTime, endTime, block.start_time, block.end_time)) {
      throw new ErrorClass(
        "This time slot is no longer available. Please choose another time.",
        409
      );
    }
  }
}

async function deactivateMatchingSpecificAvailabilitySlot(
  tutorId,
  tutorType,
  startTime,
  endTime,
  transaction
) {
  const dateStr = startTime.toISOString().split("T")[0];
  const slots = await TutorAvailability.findAll({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      is_recurring: false,
      is_active: true,
      specific_date: dateStr,
    },
    transaction,
  });

  for (const slot of slots) {
    const slotStart = combineDateAndTime(dateStr, slot.start_time);
    const slotEnd = combineDateAndTime(dateStr, slot.end_time);
    if (
      slotStart.getTime() === startTime.getTime() &&
      slotEnd.getTime() === endTime.getTime()
    ) {
      await slot.update({ is_active: false }, { transaction });
      return slot.id;
    }
    if (intervalsOverlap(startTime, endTime, slotStart, slotEnd)) {
      const bookingWithinSlot =
        startTime >= slotStart && endTime <= slotEnd;
      if (bookingWithinSlot) {
        await slot.update({ is_active: false }, { transaction });
        return slot.id;
      }
    }
  }
  return null;
}

function combineDateAndTime(dateStr, timeVal) {
  const t = String(timeVal).slice(0, 8);
  return new Date(`${dateStr}T${t}Z`);
}

/**
 * Reserve tutor calendar when a booking becomes accepted (before payment).
 */
export async function reserveCalendarForAcceptedBooking(booking, transaction) {
  const { startTime, endTime } = getAgreedBookingTimes(booking);

  const existing = await CoachingCalendarHold.findOne({
    where: { booking_request_id: booking.id },
    transaction,
  });
  if (existing?.status === "active") {
    return existing;
  }

  let availabilitySlotId = null;
  if (booking.is_from_availability) {
    availabilitySlotId = await deactivateMatchingSpecificAvailabilitySlot(
      booking.tutor_id,
      booking.tutor_type,
      startTime,
      endTime,
      transaction
    );
  }

  if (existing) {
    await existing.update(
      {
        status: "active",
        start_time: startTime,
        end_time: endTime,
        availability_slot_id: availabilitySlotId,
      },
      { transaction }
    );
    return existing;
  }

  return CoachingCalendarHold.create(
    {
      tutor_id: booking.tutor_id,
      tutor_type: booking.tutor_type,
      booking_request_id: booking.id,
      start_time: startTime,
      end_time: endTime,
      status: "active",
      availability_slot_id: availabilitySlotId,
    },
    { transaction }
  );
}

export async function releaseCalendarHoldForBooking(
  bookingId,
  { transaction, reactivateAvailability = false } = {}
) {
  const hold = await CoachingCalendarHold.findOne({
    where: { booking_request_id: bookingId },
    transaction,
  });
  if (!hold || hold.status === "released") return;

  await hold.update({ status: "released" }, { transaction });

  if (reactivateAvailability && hold.availability_slot_id) {
    await TutorAvailability.update(
      { is_active: true },
      {
        where: { id: hold.availability_slot_id },
        transaction,
      }
    );
  }
}

export async function releaseCalendarHoldAfterPayment(bookingId, transaction) {
  await releaseCalendarHoldForBooking(bookingId, {
    transaction,
    reactivateAvailability: false,
  });
}
