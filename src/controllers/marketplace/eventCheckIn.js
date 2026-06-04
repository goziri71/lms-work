import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TicketedEvent } from "../../models/marketplace/ticketedEvent.js";
import { EventTicket } from "../../models/marketplace/eventTicket.js";
import { EventTicketTier } from "../../models/marketplace/eventTicketTier.js";
import { getTutorInfo } from "./tutorLearnerManagement.js";
import { assertEventOwnedByTutor } from "../../services/eventTicketService.js";

export const checkInLookup = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const eventId = parseInt(req.params.id, 10);
  const event = await TicketedEvent.findByPk(eventId);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const { ticket_code } = req.body;
  if (!ticket_code) throw new ErrorClass("ticket_code is required", 400);

  const ticket = await EventTicket.findOne({
    where: { event_id: eventId, ticket_code: ticket_code.trim().toUpperCase() },
    include: [{ model: EventTicketTier, as: "tier", attributes: ["name"] }],
  });

  if (!ticket) {
    return res.status(200).json({
      success: true,
      data: { valid: false, message: "Ticket not found" },
    });
  }

  res.status(200).json({
    success: true,
    data: {
      valid: ticket.status === "valid",
      already_checked_in: ticket.status === "used",
      ticket: {
        id: ticket.id,
        holder_name: ticket.holder_name,
        tier_name: ticket.tier?.name,
        status: ticket.status,
      },
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

  const { ticket_code } = req.body;
  if (!ticket_code) throw new ErrorClass("ticket_code is required", 400);

  const ticket = await EventTicket.findOne({
    where: {
      event_id: eventId,
      ticket_code: ticket_code.trim().toUpperCase(),
    },
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

  res.status(200).json({
    success: true,
    message: "Checked in successfully",
    data: {
      ticket: {
        id: ticket.id,
        ticket_code: ticket.ticket_code,
        holder_name: ticket.holder_name,
        checked_in_at: ticket.checked_in_at,
      },
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
