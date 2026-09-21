import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TicketedEvent } from "../../models/marketplace/ticketedEvent.js";
import { EventTicket } from "../../models/marketplace/eventTicket.js";
import { EventTicketTier } from "../../models/marketplace/eventTicketTier.js";
import { EventTicketOrder } from "../../models/marketplace/eventTicketOrder.js";
import { getTutorInfo } from "./tutorLearnerManagement.js";
import { assertEventOwnedByTutor } from "../../services/eventTicketService.js";

function normalizeTicketCode(raw) {
  if (raw == null) return "";
  return String(raw).trim().toUpperCase().replace(/\s+/g, "");
}

/** Accept plain code or QR JSON/base64 payload that embeds `c` / ticket_code */
function extractTicketCode(body = {}) {
  const direct =
    body.ticket_code || body.code || body.ticketCode || body.qr_code || null;
  if (direct) return normalizeTicketCode(direct);

  const payload = body.qr_payload || body.payload || null;
  if (!payload || typeof payload !== "string") return "";

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
