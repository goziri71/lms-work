import { Op } from "sequelize";
import { TicketedEvent } from "../models/marketplace/ticketedEvent.js";
import { EventTicketOrder } from "../models/marketplace/eventTicketOrder.js";
import { EventTicket } from "../models/marketplace/eventTicket.js";
import { emailService } from "./emailService.js";
import { joinFrontendUrl } from "../utils/frontendUrl.js";

const HOUR = 60 * 60 * 1000;
const MAX_EMAILS_PER_RUN = 80;

function formatWhen(event) {
  try {
    return new Date(event.starts_at).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: event.timezone || "Africa/Lagos",
    });
  } catch {
    return new Date(event.starts_at).toISOString();
  }
}

function venueLine(event) {
  if (event.format === "online") return "Online";
  const parts = [event.venue_name, event.city, event.country].filter(Boolean);
  return parts.join(", ") || "See your ticket for the venue";
}

function hoursUntil(event, now) {
  return (new Date(event.starts_at).getTime() - now.getTime()) / HOUR;
}

async function sendReminderEmail(order, event, tickets, kind) {
  const when = formatWhen(event);
  const ticketsUrl = joinFrontendUrl(
    process.env.FRONTEND_URL,
    `tickets/order/${order.access_token}`
  );
  const calendarUrl = joinFrontendUrl(
    process.env.FRONTEND_URL,
    `tickets/order/${order.access_token}/calendar.ics`
  );
  const ticketList = (tickets || [])
    .filter((t) => t.status === "valid")
    .map((t) => `<li><strong>${t.ticket_code}</strong> — ${t.holder_name}</li>`)
    .join("");

  const isSoon = kind === "soon";
  const headline = isSoon
    ? `${event.title} is starting soon`
    : `Reminder: ${event.title} is tomorrow`;
  const lead = isSoon
    ? "Doors are almost here — have your ticket QR ready so you don't miss it."
    : "Your event is less than 24 hours away. Save your tickets and add it to your calendar.";

  const html = `
    <h2>${headline}</h2>
    <p>Hi ${order.buyer_name},</p>
    <p>${lead}</p>
    <p><strong>When:</strong> ${when} (${event.timezone || "Africa/Lagos"})</p>
    <p><strong>Where:</strong> ${venueLine(event)}</p>
    ${ticketList ? `<p><strong>Your tickets</strong></p><ul>${ticketList}</ul>` : ""}
    <p><a href="${ticketsUrl}">View tickets &amp; QR codes</a></p>
    <p><a href="${calendarUrl}">Add to calendar</a></p>
    <p style="font-size:12px;color:#6b7280">Nomada Events</p>
  `;

  const result = await emailService.sendEmail({
    to: order.buyer_email,
    name: order.buyer_name,
    subject: isSoon
      ? `Starting soon: ${event.title}`
      : `Tomorrow: ${event.title}`,
    htmlBody: html,
    useEventBranding: true,
  });

  return result?.success !== false;
}

/**
 * Email paid ticket holders:
 * - ~24h before start (once)
 * - ~3h before start (once)
 *
 * Safe to run every 15 minutes. Skips cancelled tickets / unpublished events.
 */
export async function sendDueEventReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 0.5 * HOUR);
  const windowEnd = new Date(now.getTime() + 26 * HOUR);

  const events = await TicketedEvent.findAll({
    where: {
      status: { [Op.in]: ["published", "sold_out"] },
      starts_at: { [Op.between]: [windowStart, windowEnd] },
    },
    attributes: [
      "id",
      "title",
      "slug",
      "format",
      "timezone",
      "starts_at",
      "venue_name",
      "city",
      "country",
    ],
  });

  if (!events.length) return { sent_24h: 0, sent_soon: 0 };

  const eventsById = new Map(events.map((e) => [e.id, e]));

  const orders = await EventTicketOrder.findAll({
    where: {
      event_id: { [Op.in]: events.map((e) => e.id) },
      status: "paid",
      [Op.or]: [
        { reminder_24h_sent_at: null },
        { reminder_soon_sent_at: null },
      ],
    },
    include: [
      {
        model: EventTicket,
        as: "tickets",
        required: false,
        attributes: ["ticket_code", "holder_name", "status"],
      },
    ],
    limit: MAX_EMAILS_PER_RUN * 2,
  });

  let sent24h = 0;
  let sentSoon = 0;

  for (const order of orders) {
    if (sent24h + sentSoon >= MAX_EMAILS_PER_RUN) break;

    const event = eventsById.get(order.event_id);
    if (!event || !order.buyer_email) continue;

    const hrs = hoursUntil(event, now);
    const tickets = order.tickets || [];

    if (hrs <= 24 && hrs > 3 && !order.reminder_24h_sent_at) {
      const ok = await sendReminderEmail(order, event, tickets, "24h");
      if (ok) {
        await order.update({ reminder_24h_sent_at: now });
        sent24h += 1;
      }
      continue;
    }

    if (hrs <= 3 && hrs > -0.5 && !order.reminder_soon_sent_at) {
      const ok = await sendReminderEmail(order, event, tickets, "soon");
      if (ok) {
        await order.update({
          reminder_soon_sent_at: now,
          reminder_24h_sent_at: order.reminder_24h_sent_at || now,
        });
        sentSoon += 1;
      }
    }
  }

  if (sent24h || sentSoon) {
    console.log(
      `📧 Event reminders sent: ${sent24h} (24h), ${sentSoon} (starting soon)`
    );
  }

  return { sent_24h: sent24h, sent_soon: sentSoon };
}
