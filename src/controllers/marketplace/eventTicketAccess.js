import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TicketedEvent } from "../../models/marketplace/ticketedEvent.js";
import { EventTicketOrder } from "../../models/marketplace/eventTicketOrder.js";
import { EventTicket } from "../../models/marketplace/eventTicket.js";
import { EventTicketTier } from "../../models/marketplace/eventTicketTier.js";
import {
  formatEventPublic,
  buildQrPayload,
  sendTicketConfirmationEmail,
} from "../../services/eventTicketService.js";
import { joinFrontendUrl } from "../../utils/frontendUrl.js";
async function loadOrderByAccessToken(accessToken) {
  const order = await EventTicketOrder.findOne({
    where: { access_token: accessToken, status: "paid" },
  });
  if (!order) throw new ErrorClass("Tickets not found or order not paid", 404);
  return order;
}

export const getTicketsByAccessToken = TryCatchFunction(async (req, res) => {
  const order = await loadOrderByAccessToken(req.params.accessToken);
  const event = await TicketedEvent.findByPk(order.event_id);
  const tickets = await EventTicket.findAll({
    where: { order_id: order.id },
    include: [{ model: EventTicketTier, as: "tier", attributes: ["name"] }],
  });

  const eventPublic = formatEventPublic(event, { includeOnlineUrl: true });
  const ticketsUrl = joinFrontendUrl(
    process.env.FRONTEND_URL,
    `tickets/order/${order.access_token}`
  );

  res.status(200).json({
    success: true,
    data: {
      order: {
        id: order.id,
        status: order.status,
        buyer_email: order.buyer_email,
        event: {
          ...eventPublic,
          calendar_links: {
            ics_download_url: `/api/marketplace/tickets/order/${order.access_token}/calendar.ics`,
          },
        },
      },
      tickets: tickets.map((t) => ({
        id: t.id,
        ticket_code: t.ticket_code,
        status: t.status,
        tier_name: t.tier?.name,
        holder_name: t.holder_name,
        qr_payload: buildQrPayload(t),
      })),
      tickets_url: ticketsUrl,
    },
  });
});

export const downloadEventCalendarIcs = TryCatchFunction(async (req, res) => {
  const order = await loadOrderByAccessToken(req.params.accessToken);
  const event = await TicketedEvent.findByPk(order.event_id);

  const start = new Date(event.starts_at).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const end = new Date(event.ends_at).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LMS//Event Tickets//EN",
    "BEGIN:VEVENT",
    `UID:event-${event.id}-order-${order.id}@lms`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.title.replace(/,/g, "\\,")}`,
    `DESCRIPTION:Tickets for ${event.title}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="event-${event.slug}.ics"`
  );
  res.send(ics);
});

export const resendTicketEmail = TryCatchFunction(async (req, res) => {
  const order = await loadOrderByAccessToken(req.params.accessToken);
  const email = req.body?.email
    ? String(req.body.email).trim().toLowerCase()
    : order.buyer_email;

  if (email !== order.buyer_email) {
    throw new ErrorClass("Email does not match order", 400);
  }

  const event = await TicketedEvent.findByPk(order.event_id);
  const tickets = await EventTicket.findAll({ where: { order_id: order.id } });
  await sendTicketConfirmationEmail(order, event, tickets);

  res.status(200).json({
    success: true,
    message: "Confirmation email sent",
  });
});

export const getMyTickets = TryCatchFunction(async (req, res) => {
  if (req.user?.userType !== "student") {
    throw new ErrorClass("Student authentication required", 401);
  }

  const { page = 1, limit = 20, upcoming } = req.query;
  const where = { student_id: req.user.id, status: "paid" };

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await EventTicketOrder.findAndCountAll({
    where,
    limit: parseInt(limit, 10),
    offset,
    order: [["paid_at", "DESC"]],
  });

  const items = await Promise.all(
    rows.map(async (order) => {
      const event = await TicketedEvent.findByPk(order.event_id, {
        attributes: [
          "id",
          "title",
          "slug",
          "starts_at",
          "ends_at",
          "timezone",
          "format",
          "cover_image_url",
          "status",
        ],
      });
      if (upcoming === "true" && event && new Date(event.ends_at) < new Date()) {
        return null;
      }
      return {
        order_id: order.id,
        ticket_count: order.ticket_count,
        total_amount: parseFloat(order.total_amount).toFixed(2),
        currency: order.currency,
        paid_at: order.paid_at,
        access_token: order.access_token,
        event,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: {
      items: items.filter(Boolean),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count,
        total_pages: Math.ceil(count / parseInt(limit, 10)),
      },
    },
  });
});
