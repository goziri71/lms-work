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
