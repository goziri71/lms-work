import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TicketedEvent } from "../../models/marketplace/ticketedEvent.js";
import { EventTicket } from "../../models/marketplace/eventTicket.js";
import { EventTicketTier } from "../../models/marketplace/eventTicketTier.js";
import { EventTicketOrder } from "../../models/marketplace/eventTicketOrder.js";
import { getTutorInfo } from "./tutorLearnerManagement.js";
import { assertEventOwnedByTutor } from "../../services/eventTicketService.js";
import { logEventActivity, actorFromReq } from "../../services/eventActivityService.js";

function normalizeTicketCode(raw) {
  if (raw == null) return "";
  return String(raw).trim().toUpperCase().replace(/\s+/g, "");
}

/** Pull code from URL like https://app.thenomada.com/t/YDHSJ3 or ?c=YDHSJ3 */
function ticketCodeFromUrl(raw) {
  const text = String(raw || "").trim();
  if (!/^https?:\/\//i.test(text)) return "";
  try {
    const url = new URL(text);
    const q =
      url.searchParams.get("c") ||
      url.searchParams.get("code") ||
      url.searchParams.get("ticket_code");
    if (q) return normalizeTicketCode(q);

    const parts = url.pathname.split("/").filter(Boolean);
    const tIndex = parts.findIndex((p) => p.toLowerCase() === "t");
    if (tIndex >= 0 && parts[tIndex + 1]) {
      return normalizeTicketCode(parts[tIndex + 1]);
    }
    const scanIndex = parts.findIndex((p) => p.toLowerCase() === "scan");
    if (scanIndex >= 0 && parts[scanIndex + 1]) {
      return normalizeTicketCode(parts[scanIndex + 1]);
    }
    const last = parts[parts.length - 1];
    if (last && /^[A-Z0-9]{4,12}$/i.test(last)) {
      return normalizeTicketCode(last);
    }
  } catch {
    return "";
  }
  return "";
}

/** Accept plain code, ticket URL, or legacy QR JSON/base64 payload */
function extractTicketCode(body = {}) {
  const direct =
    body.ticket_code || body.code || body.ticketCode || body.qr_code || null;
  if (direct) {
    return ticketCodeFromUrl(direct) || normalizeTicketCode(direct);
  }

  const payload = body.qr_payload || body.payload || body.qr_url || null;
  if (!payload || typeof payload !== "string") return "";

  const fromUrl = ticketCodeFromUrl(payload);
  if (fromUrl) return fromUrl;

  try {
    const json = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
    return normalizeTicketCode(json.c || json.ticket_code || json.code);
  } catch {
    try {
      const json = JSON.parse(payload);
      return normalizeTicketCode(json.c || json.ticket_code || json.code);
    } catch {
      return normalizeTicketCode(payload);
    }
  }
}

function formatLookupTicket(ticket) {
  const order = ticket.order || null;
  return {
    id: ticket.id,
    ticket_code: ticket.ticket_code,
    status: ticket.status,
    holder_name: ticket.holder_name,
    holder_email: ticket.holder_email,
    tier_id: ticket.tier_id,
    tier_name: ticket.tier?.name || null,
    checked_in_at: ticket.checked_in_at || null,
    buyer: {
      name: order?.buyer_name || ticket.holder_name || null,
      email: order?.buyer_email || ticket.holder_email || null,
      phone: order?.buyer_phone || null,
    },
    order: order
      ? {
          id: order.id,
          status: order.status,
          paid_at: order.paid_at,
          ticket_count: order.ticket_count,
          total_amount: order.total_amount,
          currency: order.currency,
        }
      : null,
  };
}

export const checkInLookup = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const eventId = parseInt(req.params.id, 10);
  const event = await TicketedEvent.findByPk(eventId);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const ticketCode = extractTicketCode(req.body);
  if (!ticketCode) {
    throw new ErrorClass("ticket_code is required", 400);
  }

  const ticket = await EventTicket.findOne({
    where: {
      event_id: eventId,
      ticket_code: { [Op.iLike]: ticketCode },
    },
    include: [
      { model: EventTicketTier, as: "tier", attributes: ["id", "name", "price"] },
      {
        model: EventTicketOrder,
        as: "order",
        attributes: [
          "id",
          "buyer_name",
          "buyer_email",
          "buyer_phone",
          "status",
          "paid_at",
          "ticket_count",
          "total_amount",
          "currency",
        ],
      },
    ],
  });

  if (!ticket) {
    return res.status(200).json({
      success: true,
      message: "Ticket not found",
      data: {
        found: false,
        valid: false,
        already_checked_in: false,
        ticket_code: ticketCode,
        ticket: null,
        customer: null,
      },
    });
  }

  const formatted = formatLookupTicket(ticket);
  const isValid = ticket.status === "valid";
  const alreadyCheckedIn = ticket.status === "used";

  res.status(200).json({
    success: true,
    message: alreadyCheckedIn
      ? "Ticket already checked in"
      : isValid
        ? "Ticket found"
        : `Ticket status: ${ticket.status}`,
    data: {
      found: true,
      valid: isValid,
      already_checked_in: alreadyCheckedIn,
      ticket_code: ticket.ticket_code,
      ticket: formatted,
      customer: formatted.buyer,
    },
  });
});

export const checkInTicket = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const checkerId = req.user.id;
  const eventId = parseInt(req.params.id, 10);
  const event = await TicketedEvent.findByPk(eventId);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const ticketCode = extractTicketCode(req.body);
  if (!ticketCode) throw new ErrorClass("ticket_code is required", 400);

  const ticket = await EventTicket.findOne({
    where: {
      event_id: eventId,
      ticket_code: { [Op.iLike]: ticketCode },
    },
    include: [
      { model: EventTicketTier, as: "tier", attributes: ["id", "name"] },
      {
        model: EventTicketOrder,
        as: "order",
        attributes: [
          "id",
          "buyer_name",
          "buyer_email",
          "buyer_phone",
          "status",
          "paid_at",
          "ticket_count",
          "total_amount",
          "currency",
        ],
      },
    ],
  });

  if (!ticket) throw new ErrorClass("Ticket not found", 404);
  if (ticket.status === "cancelled") {
    throw new ErrorClass("Ticket is cancelled", 400);
  }
  if (ticket.status === "used") {
    throw new ErrorClass("Ticket already checked in", 400);
  }

  await ticket.update({
    status: "used",
    checked_in_at: new Date(),
    checked_in_by: checkerId,
  });

  logEventActivity({
    eventId,
    action: "ticket_checked_in",
    ...actorFromReq(req),
    orderId: ticket.order_id,
    ticketId: ticket.id,
    metadata: { ticket_code: ticket.ticket_code },
  }).catch(() => {});

  const formatted = formatLookupTicket(ticket);
  formatted.status = "used";
  formatted.checked_in_at = ticket.checked_in_at;

  res.status(200).json({
    success: true,
    message: "Checked in successfully",
    data: {
      found: true,
      valid: false,
      already_checked_in: true,
      ticket_code: ticket.ticket_code,
      ticket: formatted,
      customer: formatted.buyer,
    },
  });
});

export const checkInStats = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const ticketsSold = await EventTicket.count({
    where: { event_id: event.id, status: { [Op.ne]: "cancelled" } },
  });
  const checkedIn = await EventTicket.count({
    where: { event_id: event.id, status: "used" },
  });

  res.status(200).json({
    success: true,
    data: {
      tickets_sold: ticketsSold,
      checked_in: checkedIn,
      remaining: ticketsSold - checkedIn,
    },
  });
});

const TICKET_INCLUDES = [
  { model: EventTicketTier, as: "tier", attributes: ["id", "name"] },
  {
    model: EventTicketOrder,
    as: "order",
    attributes: [
      "id",
      "buyer_name",
      "buyer_email",
      "buyer_phone",
      "status",
      "paid_at",
      "ticket_count",
      "total_amount",
      "currency",
    ],
  },
];

function mapOfflineAttendee(ticket) {
  const formatted = formatLookupTicket(ticket);
  return {
    ticket_id: ticket.id,
    ticket_code: ticket.ticket_code,
    status: ticket.status,
    holder_name: ticket.holder_name,
    holder_email: ticket.holder_email,
    tier_name: ticket.tier?.name || null,
    checked_in_at: ticket.checked_in_at || null,
    buyer_name: formatted.buyer.name,
    buyer_email: formatted.buyer.email,
    buyer_phone: formatted.buyer.phone,
  };
}

/**
 * Snapshot for door staff — cache on device before the event.
 * GET /tutor/events/:id/check-in/offline-pack
 */
export const getOfflineCheckInPack = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const tickets = await EventTicket.findAll({
    where: { event_id: event.id, status: { [Op.ne]: "cancelled" } },
    include: TICKET_INCLUDES,
    order: [["created_at", "ASC"]],
  });

  const downloadedAt = new Date();
  const attendees = tickets.map(mapOfflineAttendee);

  res.status(200).json({
    success: true,
    message: "Offline check-in pack ready",
    data: {
      event: {
        id: event.id,
        title: event.title,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        timezone: event.timezone,
      },
      downloaded_at: downloadedAt.toISOString(),
      attendee_count: attendees.length,
      already_checked_in: attendees.filter((a) => a.status === "used").length,
      attendees,
    },
  });
});

/**
 * Apply check-ins recorded while offline.
 * POST /tutor/events/:id/check-in/sync
 * Body: { check_ins: [{ ticket_code, checked_in_at? }] }
 */
export const syncOfflineCheckIns = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const checkerId = req.user.id;
  const eventId = parseInt(req.params.id, 10);
  const event = await TicketedEvent.findByPk(eventId);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const raw = req.body?.check_ins || req.body?.checkIns || [];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ErrorClass("check_ins must be a non-empty array", 400);
  }
  if (raw.length > 500) {
    throw new ErrorClass("Maximum 500 check-ins per sync", 400);
  }

  const results = {
    applied: [],
    already_checked_in: [],
    not_found: [],
    rejected: [],
  };

  for (const item of raw) {
    const ticketCode = normalizeTicketCode(
      item?.ticket_code || item?.code || item?.ticketCode
    );
    if (!ticketCode) {
      results.rejected.push({
        ticket_code: null,
        reason: "ticket_code is required",
      });
      continue;
    }

    const ticket = await EventTicket.findOne({
      where: {
        event_id: eventId,
        ticket_code: { [Op.iLike]: ticketCode },
      },
    });

    if (!ticket) {
      results.not_found.push({ ticket_code: ticketCode });
      continue;
    }

    if (ticket.status === "cancelled") {
      results.rejected.push({
        ticket_code: ticket.ticket_code,
        reason: "cancelled",
      });
      continue;
    }

    if (ticket.status === "used") {
      results.already_checked_in.push({
        ticket_code: ticket.ticket_code,
        checked_in_at: ticket.checked_in_at,
      });
      continue;
    }

    const offlineAt = item.checked_in_at ? new Date(item.checked_in_at) : new Date();
    const checkedInAt = Number.isNaN(offlineAt.getTime()) ? new Date() : offlineAt;

    await ticket.update({
      status: "used",
      checked_in_at: checkedInAt,
      checked_in_by: checkerId,
    });

    results.applied.push({
      ticket_code: ticket.ticket_code,
      checked_in_at: ticket.checked_in_at,
    });

    logEventActivity({
      eventId,
      action: "ticket_checked_in",
      ...actorFromReq(req),
      orderId: ticket.order_id,
      ticketId: ticket.id,
      metadata: { ticket_code: ticket.ticket_code, source: "offline_sync" },
    }).catch(() => {});
  }

  res.status(200).json({
    success: true,
    message: "Offline check-ins synced",
    data: {
      applied_count: results.applied.length,
      already_checked_in_count: results.already_checked_in.length,
      not_found_count: results.not_found.length,
      rejected_count: results.rejected.length,
      ...results,
    },
  });
});
