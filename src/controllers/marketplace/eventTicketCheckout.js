import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TicketedEvent } from "../../models/marketplace/ticketedEvent.js";
import { EventTicketOrder } from "../../models/marketplace/eventTicketOrder.js";
import { db } from "../../database/database.js";
import {
  validateOrderItems,
  reserveTierInventory,
  releaseTierReservation,
  fulfillPaidOrder,
  payOrderWithWallet,
  confirmOrderFlutterwave,
  buildOrderTxRef,
  buildFlutterwavePaymentPayload,
  generateAccessToken,
  RESERVATION_MINUTES,
} from "../../services/eventTicketService.js";

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export const createEventOrder = TryCatchFunction(async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (!eventId) throw new ErrorClass("Invalid event ID", 400);

  const event = await TicketedEvent.findByPk(eventId);
  if (!event) throw new ErrorClass("Event not found", 404);
  if (event.status !== "published") {
    throw new ErrorClass("Event is not available for ticket sales", 400);
  }
  if (new Date(event.ends_at) < new Date()) {
    throw new ErrorClass("This event has ended", 400);
  }

  const {
    buyer_email,
    buyer_name,
    buyer_phone,
    items,
    payment_method,
    holder_names,
  } = req.body;

  if (!buyer_email || !buyer_name) {
    throw new ErrorClass("buyer_email and buyer_name are required", 400);
  }

  const idempotencyKey = req.get("Idempotency-Key") || req.get("idempotency-key");
  if (idempotencyKey) {
    const existing = await EventTicketOrder.findOne({
      where: { idempotency_key: idempotencyKey },
    });
    if (existing) {
      return respondWithOrder(res, existing, event);
    }
  }

  const studentId =
    req.user?.userType === "student" ? parseInt(req.user.id, 10) : null;

  const { lineItems, totalTickets, totalAmount, currency, tiersToReserve } =
    await validateOrderItems(eventId, items);

  const isFree = totalAmount <= 0;
  const payMethod = payment_method || (isFree ? "free" : "flutterwave");

  if (!isFree && studentId && payMethod === "wallet") {
    // allowed
  } else if (!isFree && payMethod !== "flutterwave") {
    if (!studentId) {
      throw new ErrorClass("Guests must use flutterwave for paid orders", 400);
    }
  }

  const transaction = await db.transaction();
  let order;

  try {
    await reserveTierInventory(tiersToReserve, transaction);

    const expiresAt = isFree
      ? null
      : new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

    order = await EventTicketOrder.create(
      {
        event_id: eventId,
        student_id: studentId,
        buyer_email: normalizeEmail(buyer_email),
        buyer_name: buyer_name.trim(),
        buyer_phone: buyer_phone || null,
        status: isFree ? "pending" : "pending",
        total_amount: totalAmount,
        currency,
        ticket_count: totalTickets,
        line_items: lineItems,
        payment_method: payMethod,
        idempotency_key: idempotencyKey || null,
        reservation_expires_at: expiresAt,
        access_token: generateAccessToken(),
      },
      { transaction }
    );

    if (!isFree) {
      const txRef = buildOrderTxRef(order.id);
      await order.update({ transaction_ref: txRef }, { transaction });
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  if (isFree) {
    const { order: paidOrder, tickets } = await fulfillPaidOrder(order.id, {
      paymentMethod: "free",
      holderNames: holder_names,
    });
    return res.status(200).json({
      success: true,
      message: "RSVP confirmed",
      data: buildSuccessPayload(paidOrder, tickets),
    });
  }

  if (studentId && payMethod === "wallet") {
    const { order: paidOrder, tickets } = await payOrderWithWallet(
      order.id,
      studentId
    );
    return res.status(200).json({
      success: true,
      message: "Order paid with wallet",
      data: buildSuccessPayload(paidOrder, tickets),
    });
  }

  const refreshed = await EventTicketOrder.findByPk(order.id);
  return res.status(201).json({
    success: true,
    message: "Order created",
    data: {
      order: formatOrder(refreshed),
      payment: buildFlutterwavePaymentPayload(refreshed),
    },
  });
});

async function respondWithOrder(res, order, event) {
  if (order.status === "paid") {
    const { EventTicket } = await import("../../models/marketplace/eventTicket.js");
    const tickets = await EventTicket.findAll({ where: { order_id: order.id } });
    return res.status(200).json({
      success: true,
      message: "Order already completed",
      data: buildSuccessPayload(order, tickets),
    });
  }
  return res.status(201).json({
    success: true,
    message: "Order created",
    data: {
      order: formatOrder(order),
      payment: buildFlutterwavePaymentPayload(order),
    },
  });
}

function formatOrder(order) {
  return {
    id: order.id,
    status: order.status,
    total_amount: parseFloat(order.total_amount).toFixed(2),
    currency: order.currency,
    ticket_count: order.ticket_count,
    reservation_expires_at: order.reservation_expires_at,
  };
}

function buildSuccessPayload(order, tickets) {
  return {
    order: formatOrder(order),
    access_token: order.access_token,
    tickets_url: `/tickets/order/${order.access_token}`,
    tickets: tickets.map((t) => ({
      id: t.id,
      ticket_code: t.ticket_code,
      tier_name:
        order.line_items?.find((li) => li.tier_id === t.tier_id)?.tier_name ||
        null,
    })),
  };
}

export const confirmEventOrderPayment = TryCatchFunction(async (req, res) => {
  const orderId = parseInt(req.params.orderId, 10);
  const { transaction_reference, flutterwave_transaction_id } = req.body;

  const { order, tickets, alreadyPaid } = await confirmOrderFlutterwave(
    orderId,
    { transactionReference: transaction_reference, flutterwaveTransactionId: flutterwave_transaction_id }
  );

  res.status(200).json({
    success: true,
    message: alreadyPaid ? "Order already paid" : "Payment confirmed",
    data: buildSuccessPayload(order, tickets),
  });
});

export const payEventOrderWithWallet = TryCatchFunction(async (req, res) => {
  if (req.user?.userType !== "student") {
    throw new ErrorClass("Student authentication required", 401);
  }

  const orderId = parseInt(req.params.orderId, 10);
  const { order, tickets } = await payOrderWithWallet(orderId, req.user.id);

  res.status(200).json({
    success: true,
    message: "Payment successful",
    data: buildSuccessPayload(order, tickets),
  });
});

export const getEventOrderStatus = TryCatchFunction(async (req, res) => {
  const orderId = parseInt(req.params.orderId, 10);
  const order = await EventTicketOrder.findByPk(orderId);
  if (!order) throw new ErrorClass("Order not found", 404);

  const token = req.query.access_token;
  if (token && order.access_token !== token) {
    throw new ErrorClass("Invalid access token", 403);
  }
  if (
    req.user?.userType === "student" &&
    order.student_id &&
    order.student_id !== req.user.id
  ) {
    throw new ErrorClass("Forbidden", 403);
  }

  res.status(200).json({
    success: true,
    data: {
      order_id: order.id,
      status: order.status,
      access_token: order.status === "paid" ? order.access_token : null,
    },
  });
});

export const cancelEventOrder = TryCatchFunction(async (req, res) => {
  const orderId = parseInt(req.params.orderId, 10);
  const order = await EventTicketOrder.findByPk(orderId);
  if (!order) throw new ErrorClass("Order not found", 404);
  if (order.status !== "pending") {
    throw new ErrorClass(`Cannot cancel order with status ${order.status}`, 400);
  }

  const transaction = await db.transaction();
  try {
    await releaseTierReservation(order.line_items, transaction);
    await order.update({ status: "cancelled" }, { transaction });
    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }

  res.status(200).json({
    success: true,
    message: "Order cancelled",
  });
});
