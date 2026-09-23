import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TicketedEvent } from "../../models/marketplace/ticketedEvent.js";
import { EventTicketTier } from "../../models/marketplace/eventTicketTier.js";
import { EventTicketOrder } from "../../models/marketplace/eventTicketOrder.js";
import { EventTicket } from "../../models/marketplace/eventTicket.js";
import { EventActivityLog } from "../../models/marketplace/eventActivityLog.js";
import { getTutorInfo } from "./tutorLearnerManagement.js";
import { assertEventOwnedByTutor } from "../../services/eventTicketService.js";

function money(n) {
  return parseFloat(n || 0).toFixed(2);
}

function orderDiscount(order) {
  const items = Array.isArray(order.line_items) ? order.line_items : [];
  return items.reduce((s, li) => s + parseFloat(li.discount_amount || 0), 0);
}

function orderListGross(order) {
  const items = Array.isArray(order.line_items) ? order.line_items : [];
  const listed = items.reduce((s, li) => {
    const list = parseFloat(li.list_price || li.unit_price || 0);
    const qty = parseInt(li.quantity || 0, 10);
    return s + list * qty;
  }, 0);
  return listed > 0 ? listed : parseFloat(order.total_amount || 0);
}

/**
 * Full forensic dashboard
 * GET /tutor/events/:id/forensics
 */
export const getEventForensics = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const [tiers, orders, tickets, viewLogs, recentActivity] = await Promise.all([
    EventTicketTier.findAll({ where: { event_id: event.id } }),
    EventTicketOrder.findAll({ where: { event_id: event.id } }),
    EventTicket.findAll({
      where: { event_id: event.id, status: { [Op.ne]: "cancelled" } },
    }),
    EventActivityLog.count({
      where: { event_id: event.id, action: "page_viewed" },
    }),
    EventActivityLog.findAll({
      where: { event_id: event.id, action: { [Op.ne]: "page_viewed" } },
      order: [["created_at", "DESC"]],
      limit: 25,
    }),
  ]);

  const byStatus = {
    pending: 0,
    pending_approval: 0,
    paid: 0,
    cancelled: 0,
    rejected: 0,
    refunded: 0,
    failed: 0,
  };

  let grossPaid = 0;
  let discounts = 0;
  let listGross = 0;
  let platformFees = 0;
  let creatorEarnings = 0;
  let refundedAmount = 0;
  let freeTickets = 0;
  let paidOrders = 0;
  const currency = orders[0]?.currency || tiers[0]?.currency || "NGN";

  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    const amt = parseFloat(o.total_amount || 0);
    const disc = orderDiscount(o);
    if (o.status === "paid") {
      if (amt > 0) {
        grossPaid += amt;
        paidOrders += 1;
        listGross += orderListGross(o);
        discounts += disc;
        platformFees += parseFloat(o.platform_fee || 0);
        creatorEarnings += parseFloat(o.tutor_earnings || 0);
      } else {
        freeTickets += o.ticket_count || 0;
      }
    }
    if (o.status === "refunded" || o.status === "rejected") {
      refundedAmount += amt;
    }
  }

  const ticketsIssued = tickets.length;
  const checkedIn = tickets.filter((t) => t.status === "used").length;
  const checkoutsStarted = orders.length;

  const byTier = tiers.map((t) => {
    const tierTickets = tickets.filter((x) => x.tier_id === t.id);
    const tierOrders = orders.filter((o) =>
      (o.line_items || []).some((li) => parseInt(li.tier_id, 10) === t.id)
    );
    const paid = tierOrders.filter((o) => o.status === "paid");
    const revenue = paid.reduce((s, o) => {
      const li = (o.line_items || []).find(
        (x) => parseInt(x.tier_id, 10) === t.id
      );
      return s + parseFloat(li?.subtotal || 0);
    }, 0);
    return {
      tier_id: t.id,
      tier_name: t.name,
      list_price: money(t.price),
      quantity_total: t.quantity_total,
      quantity_sold: t.quantity_sold,
      quantity_reserved: t.quantity_reserved,
      tickets_issued: tierTickets.length,
      checked_in: tierTickets.filter((x) => x.status === "used").length,
      revenue: money(revenue),
    };
  });

  const dayMap = {};
  for (const o of orders.filter((x) => x.status === "paid")) {
    const day = new Date(o.paid_at || o.created_at || Date.now())
      .toISOString()
      .slice(0, 10);
    if (!dayMap[day]) dayMap[day] = { date: day, orders: 0, revenue: 0, tickets: 0 };
    dayMap[day].orders += 1;
    dayMap[day].revenue += parseFloat(o.total_amount || 0);
    dayMap[day].tickets += o.ticket_count || 0;
  }
  for (const t of tickets.filter((x) => x.status === "used" && x.checked_in_at)) {
    const day = new Date(t.checked_in_at).toISOString().slice(0, 10);
    if (!dayMap[day]) dayMap[day] = { date: day, orders: 0, revenue: 0, tickets: 0 };
    dayMap[day].check_ins = (dayMap[day].check_ins || 0) + 1;
  }

  const conversion =
    viewLogs > 0 ? Math.round((paidOrders / viewLogs) * 10000) / 100 : null;

  res.status(200).json({
    success: true,
    data: {
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        sales_open: event.sales_open !== false,
        requires_approval: !!event.requires_approval,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
      },
      funnel: {
        page_views: event.view_count || viewLogs,
        page_view_events: viewLogs,
        checkouts_started: checkoutsStarted,
        pending_payment: byStatus.pending,
        pending_approval: byStatus.pending_approval,
        paid_orders: byStatus.paid,
        rejected: byStatus.rejected,
        cancelled: byStatus.cancelled,
        refunded: byStatus.refunded,
        failed: byStatus.failed,
        conversion_rate_pct: conversion,
      },
      money: {
        currency,
        list_gross: money(listGross || grossPaid + discounts),
        discounts: money(discounts),
        gross_collected: money(grossPaid),
        platform_fees: money(platformFees),
        creator_earnings: money(creatorEarnings),
        refunded: money(refundedAmount),
        free_rsvp_tickets: freeTickets,
      },
      door: {
        tickets_issued: ticketsIssued,
        checked_in: checkedIn,
        remaining: ticketsIssued - checkedIn,
        no_show:
          new Date(event.ends_at) < new Date()
            ? ticketsIssued - checkedIn
            : null,
      },
      by_tier: byTier,
      by_day: Object.values(dayMap)
        .map((d) => ({
          ...d,
          revenue: money(d.revenue),
          check_ins: d.check_ins || 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      recent_activity: recentActivity.map(formatActivity),
    },
  });
});

function formatActivity(row) {
  return {
    id: row.id,
    action: row.action,
    actor_type: row.actor_type,
    actor_id: row.actor_id,
    order_id: row.order_id,
    ticket_id: row.ticket_id,
    metadata: row.metadata || {},
    created_at: row.created_at,
  };
}

/**
 * GET /tutor/events/:id/activity
 */
export const listEventActivity = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const { page = 1, limit = 50, action, include_views } = req.query;
  const where = { event_id: event.id };
  if (action) where.action = action;
  else if (include_views !== "true") where.action = { [Op.ne]: "page_viewed" };

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await EventActivityLog.findAndCountAll({
    where,
    limit: parseInt(limit, 10),
    offset,
    order: [["created_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    data: {
      items: rows.map(formatActivity),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count,
        total_pages: Math.ceil(count / parseInt(limit, 10)),
      },
    },
  });
});

/**
 * GET /tutor/events/:id/orders/:orderId
 */
export const getEventOrderForensics = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const order = await EventTicketOrder.findOne({
    where: { id: req.params.orderId, event_id: event.id },
  });
  if (!order) throw new ErrorClass("Order not found", 404);

  const tickets = await EventTicket.findAll({
    where: { order_id: order.id },
    include: [{ model: EventTicketTier, as: "tier", attributes: ["name"] }],
  });

  const timeline = await EventActivityLog.findAll({
    where: { event_id: event.id, order_id: order.id },
    order: [["created_at", "ASC"]],
  });

  const disc = orderDiscount(order);

  res.status(200).json({
    success: true,
    data: {
      order: {
        id: order.id,
        status: order.status,
        buyer_name: order.buyer_name,
        buyer_email: order.buyer_email,
        buyer_phone: order.buyer_phone,
        payment_method: order.payment_method,
        transaction_ref: order.transaction_ref,
        ticket_count: order.ticket_count,
        currency: order.currency,
        list_gross: money(orderListGross(order)),
        discount: money(disc),
        total_paid: money(order.total_amount),
        commission_rate: order.commission_rate,
        platform_fee: money(order.platform_fee),
        tutor_earnings: money(order.tutor_earnings),
        rejection_reason: order.rejection_reason,
        paid_at: order.paid_at,
        created_at: order.created_at,
        line_items: order.line_items,
      },
      tickets: tickets.map((t) => ({
        id: t.id,
        ticket_code: t.ticket_code,
        status: t.status,
        holder_name: t.holder_name,
        holder_email: t.holder_email,
        tier_name: t.tier?.name,
        checked_in_at: t.checked_in_at,
        checked_in_by: t.checked_in_by,
      })),
      timeline: timeline.map(formatActivity),
    },
  });
});
