import { EventActivityLog } from "../models/marketplace/eventActivityLog.js";
import { TicketedEvent } from "../models/marketplace/ticketedEvent.js";

export async function logEventActivity({
  eventId,
  action,
  actorType = "system",
  actorId = null,
  orderId = null,
  ticketId = null,
  metadata = {},
}) {
  if (!eventId || !action) return null;
  try {
    return await EventActivityLog.create({
      event_id: eventId,
      action,
      actor_type: actorType,
      actor_id: actorId,
      order_id: orderId,
      ticket_id: ticketId,
      metadata: metadata || {},
    });
  } catch (err) {
    console.error("Event activity log error:", err.message);
    return null;
  }
}

export function actorFromReq(req) {
  const userType = req.user?.userType || req.user?.user_type || "guest";
  const id = req.user?.id || req.tutor?.id || null;
  return { actorType: userType, actorId: id ? parseInt(id, 10) : null };
}

export async function recordEventPageView(eventId, extra = {}) {
  if (!eventId) return;
  try {
    await TicketedEvent.increment("view_count", { where: { id: eventId } });
    await logEventActivity({
      eventId,
      action: "page_viewed",
      actorType: extra.actorType || "guest",
      actorId: extra.actorId || null,
      metadata: { source: extra.source || "public_page" },
    });
  } catch (err) {
    console.error("Event page view error:", err.message);
  }
}
