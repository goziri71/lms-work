/**
 * Compact buyer info for tutor booking UIs (logged-in student or guest).
 */
export function formatBookingBuyerProfile(bookingRow) {
  const plain = bookingRow?.get ? bookingRow.get({ plain: true }) : bookingRow;
  if (!plain) {
    return {
      id: null,
      name: null,
      email: null,
      phone: null,
      image: null,
      description: null,
      is_guest: true,
    };
  }

  const student = plain.student;
  const description = plain.description?.trim() || null;

  if (plain.student_id && student) {
    const name =
      `${student.fname || ""} ${student.lname || ""}`.trim() || null;
    return {
      id: student.id,
      name,
      email: student.email || null,
      phone: student.phone || null,
      image: student.profile_image || null,
      description,
      is_guest: false,
    };
  }

  return {
    id: null,
    name: plain.guest_name?.trim() || null,
    email: plain.guest_email?.trim() || null,
    phone: plain.guest_phone?.trim() || null,
    image: null,
    description,
    is_guest: true,
  };
}

/** Tutor-safe booking payload (no buyer payment token). */
export function serializeTutorBookingRequest(bookingRow) {
  const plain = bookingRow.get({ plain: true });
  delete plain.access_token;
  plain.student = formatBookingBuyerProfile(bookingRow);
  return plain;
}
