import crypto from "crypto";
import { Op } from "sequelize";
import { db } from "../database/database.js";
import { TicketedEvent } from "../models/marketplace/ticketedEvent.js";
import { EventTicketTier } from "../models/marketplace/eventTicketTier.js";
import { EventTicketOrder } from "../models/marketplace/eventTicketOrder.js";
import { EventTicket } from "../models/marketplace/eventTicket.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";
import { Students } from "../models/auth/student.js";
import { Funding } from "../models/payment/funding.js";
import { ErrorClass } from "../utils/errorClass/index.js";
import { getWalletBalance } from "./walletBalanceService.js";
import {
  verifyTransaction,
  isTransactionSuccessful,
  getTransactionAmount,
  getTransactionCurrency,
  getTransactionReference,
} from "./flutterwaveService.js";
import { emailService } from "./emailService.js";
import { joinFrontendUrl } from "../utils/frontendUrl.js";
import { Config } from "../config/config.js";

export const RESERVATION_MINUTES = 15;

export function generateTicketCode() {
  const part = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `EVT-${part}`;
}

export function generateAccessToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function buildOrderTxRef(orderId) {
  return `EVT-ORDER-${orderId}-${Date.now()}`;
}

export function buildQrPayload(ticket) {
  const payload = {
    t: ticket.id,
    c: ticket.ticket_code,
    e: ticket.event_id,
  };
  const sig = crypto
    .createHmac("sha256", Config.JWT_SECRET || "event-ticket")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
  return Buffer.from(JSON.stringify({ ...payload, s: sig })).toString("base64url");
}

export async function getEventHost(ownerType, ownerId) {
  if (ownerType === "sole_tutor") {
    const t = await SoleTutor.findByPk(ownerId, {
      attributes: ["id", "fname", "lname", "slug", "profile_image"],
    });
    if (!t) return null;
    return {
      owner_type: "sole_tutor",
      owner_id: t.id,
      display_name: `${t.fname || ""} ${t.lname || ""}`.trim(),
      slug: t.slug,
      logo_url: t.profile_image,
    };
  }
  const o = await Organization.findByPk(ownerId, {
    attributes: ["id", "name", "logo"],
  });
  if (!o) return null;
  return {
    owner_type: "organization",
    owner_id: o.id,
    display_name: o.name,
    slug: null,
    logo_url: o.logo,
  };
}

export function formatEventPublic(event, { includeOnlineUrl = false } = {}) {
  const venue =
    event.format === "in_person" || event.format === "hybrid"
      ? {
          venue_name: event.venue_name,
          address_line1: event.address_line1,
          city: event.city,
          region: event.region,
          country: event.country,
          latitude: event.latitude != null ? parseFloat(event.latitude) : null,
          longitude: event.longitude != null ? parseFloat(event.longitude) : null,
        }
      : null;

  const out = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    format: event.format,
    timezone: event.timezone,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    doors_open_at: event.doors_open_at,
    cover_image_url: event.cover_image_url,
    category: event.category,
    status: event.status,
    refund_policy: event.refund_policy,
    refund_policy_text: event.refund_policy_text,
    venue,
    owner_type: event.owner_type,
    owner_id: event.owner_id,
  };

  if (includeOnlineUrl && (event.format === "online" || event.format === "hybrid")) {
    out.online_url = event.online_url;
  }

  return out;
}

export function tierAvailable(tier) {
  return (
    tier.quantity_total -
    tier.quantity_sold -
    tier.quantity_reserved
  );
}

export function isTierSalesOpen(tier, now = new Date()) {
  if (tier.is_hidden) return false;
  if (tier.sales_start && new Date(tier.sales_start) > now) return false;
  if (tier.sales_end && new Date(tier.sales_end) < now) return false;
  return tierAvailable(tier) > 0;
}

export function formatTierPublic(tier) {
  const available = tierAvailable(tier);
  return {
    id: tier.id,
    name: tier.name,
    description: tier.description,
    price: parseFloat(tier.price).toFixed(2),
    currency: tier.currency,
    quantity_available: Math.max(0, available),
    max_per_order: tier.max_per_order,
    sales_start: tier.sales_start,
    sales_end: tier.sales_end,
    is_sales_open: isTierSalesOpen(tier),
  };
}

export async function assertEventOwnedByTutor(event, tutorId, tutorType) {
  if (
    event.owner_type !== tutorType ||
    parseInt(event.owner_id, 10) !== parseInt(tutorId, 10)
  ) {
    throw new ErrorClass(
      "Event not found or you don't have permission",
      403
    );
  }
}

export async function validateOrderItems(eventId, items) {
  if (!items?.length) {
    throw new ErrorClass("At least one ticket tier is required", 400);
  }

  const tiers = await EventTicketTier.findAll({
    where: { event_id: eventId },
  });
  const tierMap = new Map(tiers.map((t) => [t.id, t]));
  const now = new Date();
  let totalTickets = 0;
  let totalAmount = 0;
  const lineItems = [];
  let currency = "NGN";

  for (const item of items) {
    const tierId = parseInt(item.tier_id, 10);
    const qty = parseInt(item.quantity, 10);
    if (!tierId || !qty || qty < 1) {
      throw new ErrorClass("Invalid tier_id or quantity", 400);
    }

    const tier = tierMap.get(tierId);
    if (!tier) {
      throw new ErrorClass(`Ticket tier ${tierId} not found`, 404);
    }
    if (!isTierSalesOpen(tier, now)) {
      throw new ErrorClass(`Tier "${tier.name}" is not available for sale`, 400);
    }
    if (qty > tier.max_per_order) {
      throw new ErrorClass(
        `Maximum ${tier.max_per_order} tickets per order for "${tier.name}"`,
        400
      );
    }
    if (qty > tierAvailable(tier)) {
      throw new ErrorClass(`Not enough tickets available for "${tier.name}"`, 409);
    }

    const unitPrice = parseFloat(tier.price);
    const subtotal = Math.round(unitPrice * qty * 100) / 100;
    currency = tier.currency || currency;
    totalTickets += qty;
    totalAmount += subtotal;
    lineItems.push({
      tier_id: tier.id,
      tier_name: tier.name,
      quantity: qty,
      unit_price: unitPrice.toFixed(2),
      subtotal: subtotal.toFixed(2),
    });
  }

  return {
    lineItems,
    totalTickets,
    totalAmount: Math.round(totalAmount * 100) / 100,
    currency,
    tiersToReserve: lineItems.map((li) => ({
      tierId: li.tier_id,
      quantity: li.quantity,
    })),
  };
}

export async function reserveTierInventory(tiersToReserve, transaction) {
  for (const { tierId, quantity } of tiersToReserve) {
    const tier = await EventTicketTier.findByPk(tierId, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    const available = tierAvailable(tier);
    if (quantity > available) {
      throw new ErrorClass("Tickets no longer available", 409);
    }
    await tier.update(
      { quantity_reserved: tier.quantity_reserved + quantity },
      { transaction }
    );
  }
}

export async function releaseTierReservation(lineItems, transaction) {
  for (const li of lineItems) {
    const tier = await EventTicketTier.findByPk(li.tier_id, { transaction });
    if (!tier) continue;
    const release = Math.min(
      tier.quantity_reserved,
      parseInt(li.quantity, 10)
    );
    await tier.update(
      { quantity_reserved: tier.quantity_reserved - release },
      { transaction }
    );
  }
}

export async function confirmTierSale(lineItems, transaction) {
  for (const li of lineItems) {
    const tier = await EventTicketTier.findByPk(li.tier_id, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    const qty = parseInt(li.quantity, 10);
    await tier.update(
      {
        quantity_reserved: Math.max(0, tier.quantity_reserved - qty),
        quantity_sold: tier.quantity_sold + qty,
      },
      { transaction }
    );
  }
}

export async function issueTicketsForOrder(order, holderNames, transaction) {
  const tickets = [];
  let nameIndex = 0;
  const holders =
    holderNames?.length === order.ticket_count
      ? holderNames
      : Array(order.ticket_count).fill(order.buyer_name);

  for (const li of order.line_items) {
    const qty = parseInt(li.quantity, 10);
    for (let i = 0; i < qty; i++) {
      const holderName = holders[nameIndex++] || order.buyer_name;
      let code;
      for (let attempt = 0; attempt < 5; attempt++) {
        code = generateTicketCode();
        const exists = await EventTicket.findOne({
          where: { ticket_code: code },
          transaction,
        });
        if (!exists) break;
      }
      const ticket = await EventTicket.create(
        {
          order_id: order.id,
          event_id: order.event_id,
          tier_id: li.tier_id,
          ticket_code: code,
          holder_name: holderName,
          holder_email: order.buyer_email,
          status: "valid",
        },
        { transaction }
      );
      tickets.push(ticket);
    }
  }
  return tickets;
}

export async function fulfillPaidOrder(
  orderId,
  { paymentMethod, transactionRef, flutterwaveId, holderNames } = {}
) {
  const transaction = await db.transaction();
  try {
    const order = await EventTicketOrder.findByPk(orderId, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!order) {
      throw new ErrorClass("Order not found", 404);
    }
    if (order.status === "paid") {
      await transaction.commit();
      const tickets = await EventTicket.findAll({ where: { order_id: order.id } });
      return { order, tickets, alreadyPaid: true };
    }
    if (order.status !== "pending") {
      throw new ErrorClass(`Order cannot be completed (status: ${order.status})`, 400);
    }

    if (
      order.reservation_expires_at &&
      new Date(order.reservation_expires_at) < new Date()
    ) {
      await releaseTierReservation(order.line_items, transaction);
      await order.update({ status: "cancelled" }, { transaction });
      await transaction.commit();
      throw new ErrorClass("Reservation expired. Please start checkout again.", 410);
    }

    await confirmTierSale(order.line_items, transaction);

    const accessToken = order.access_token || generateAccessToken();
    await order.update(
      {
        status: "paid",
        payment_method: paymentMethod || order.payment_method,
        transaction_ref: transactionRef || order.transaction_ref,
        flutterwave_transaction_id:
          flutterwaveId || order.flutterwave_transaction_id,
        access_token: accessToken,
        paid_at: new Date(),
        reservation_expires_at: null,
      },
      { transaction }
    );

    const tickets = await issueTicketsForOrder(order, holderNames, transaction);

    const event = await TicketedEvent.findByPk(order.event_id, { transaction });
    await maybeMarkEventSoldOut(event, transaction);

    await transaction.commit();

    sendTicketConfirmationEmail(order, event, tickets).catch((err) =>
      console.error("Ticket email error:", err.message)
    );

    return { order, tickets, alreadyPaid: false };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function maybeMarkEventSoldOut(event, transaction) {
  if (!event || event.status !== "published") return;
  const tiers = await EventTicketTier.findAll({
    where: { event_id: event.id },
    transaction,
  });
  const allSold = tiers.every((t) => tierAvailable(t) <= 0);
  if (allSold) {
    await event.update({ status: "sold_out" }, { transaction });
  }
}

export async function sendTicketConfirmationEmail(order, event, tickets) {
  const ticketsUrl = joinFrontendUrl(
    process.env.FRONTEND_URL,
    `tickets/order/${order.access_token}`
  );
  const ticketList = tickets
    .map((t) => `<li><strong>${t.ticket_code}</strong> — ${t.holder_name}</li>`)
    .join("");

  const html = `
    <h2>Your tickets for ${event.title}</h2>
    <p>Hi ${order.buyer_name},</p>
    <p>Your order is confirmed. Event starts: ${new Date(event.starts_at).toLocaleString()} (${event.timezone})</p>
    <ul>${ticketList}</ul>
    <p><a href="${ticketsUrl}">View tickets & QR codes</a></p>
  `;

  await emailService.sendEmail({
    to: order.buyer_email,
    name: order.buyer_name,
    subject: `Tickets confirmed: ${event.title}`,
    htmlBody: html,
    useTutorLearnerBranding: true,
  });
}

export async function payOrderWithWallet(orderId, studentId) {
  const student = await Students.findByPk(studentId);
  if (!student) throw new ErrorClass("Student not found", 404);

  const order = await EventTicketOrder.findByPk(orderId);
  if (!order) throw new ErrorClass("Order not found", 404);
  if (order.student_id && order.student_id !== studentId) {
    throw new ErrorClass("Order does not belong to this account", 403);
  }
  if (parseFloat(order.total_amount) <= 0) {
    throw new ErrorClass("This order is free — no wallet payment needed", 400);
  }
  if (order.status !== "pending") {
    throw new ErrorClass(`Order is ${order.status}`, 400);
  }

  const { balance } = await getWalletBalance(studentId, true);
  const amount = parseFloat(order.total_amount);
  if (balance < amount) {
    throw new ErrorClass(
      `Insufficient wallet balance. Required: ${amount.toFixed(2)} ${order.currency}, Available: ${balance.toFixed(2)}`,
      400
    );
  }

  const txRef = buildOrderTxRef(order.id);
  const today = new Date().toISOString().split("T")[0];
  const transaction = await db.transaction();

  try {
    const newBalance = balance - amount;
    await Funding.create(
      {
        student_id: studentId,
        amount,
        type: "Debit",
        service_name: "Event Ticket Purchase",
        ref: txRef,
        date: today,
        semester: null,
        academic_year: null,
        currency: order.currency,
        balance: newBalance.toString(),
      },
      { transaction }
    );
    await student.update({ wallet_balance: newBalance }, { transaction });
    await order.update(
      {
        student_id: studentId,
        payment_method: "wallet",
        transaction_ref: txRef,
      },
      { transaction }
    );
    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }

  return fulfillPaidOrder(orderId, { paymentMethod: "wallet", transactionRef: txRef });
}

export async function confirmOrderFlutterwave(orderId, { transactionReference, flutterwaveTransactionId }) {
  const order = await EventTicketOrder.findByPk(orderId);
  if (!order) throw new ErrorClass("Order not found", 404);
  if (order.status === "paid") {
    const tickets = await EventTicket.findAll({ where: { order_id: order.id } });
    return { order, tickets, alreadyPaid: true };
  }

  const verifyId = flutterwaveTransactionId || transactionReference || order.transaction_ref;
  if (!verifyId) {
    throw new ErrorClass("transaction_reference or flutterwave_transaction_id required", 400);
  }

  const verification = await verifyTransaction(String(verifyId), {
    maxRetries: 3,
    retryDelayMs: 1500,
  });

  if (!verification.success || !verification.transaction) {
    throw new ErrorClass(
      verification.message || "Payment verification failed",
      400
    );
  }

  const fw = verification.transaction;
  if (!isTransactionSuccessful(fw)) {
    throw new ErrorClass("Payment was not successful", 400);
  }

  const fwRef = getTransactionReference(fw);
  if (order.transaction_ref && fwRef && fwRef !== order.transaction_ref) {
    throw new ErrorClass("Transaction reference does not match order", 400);
  }

  const paidAmount = parseFloat(getTransactionAmount(fw));
  const expected = parseFloat(order.total_amount);
  if (Math.abs(paidAmount - expected) > 0.02) {
    throw new ErrorClass(
      `Payment amount mismatch. Expected ${expected}, received ${paidAmount}`,
      400
    );
  }

  return fulfillPaidOrder(orderId, {
    paymentMethod: "flutterwave",
    transactionRef: fwRef || order.transaction_ref,
    flutterwaveId: fw.id?.toString(),
  });
}

/** Webhook helper when meta.type === event_ticket */
export async function fulfillEventOrderFromWebhook(txRef, transactionData) {
  const order = await EventTicketOrder.findOne({
    where: { transaction_ref: txRef },
  });
  if (!order || order.status === "paid") return { handled: !!order, order };

  if (!isTransactionSuccessful(transactionData)) {
    return { handled: false, order };
  }

  const paidAmount = parseFloat(getTransactionAmount(transactionData));
  if (Math.abs(paidAmount - parseFloat(order.total_amount)) > 0.02) {
    console.error(`Event order ${order.id} amount mismatch on webhook`);
    return { handled: false, order };
  }

  const result = await fulfillPaidOrder(order.id, {
    paymentMethod: "flutterwave",
    transactionRef: txRef,
    flutterwaveId: transactionData.id?.toString(),
  });
  return { handled: true, order: result.order };
}

export async function expireStalePendingOrders() {
  const stale = await EventTicketOrder.findAll({
    where: {
      status: "pending",
      reservation_expires_at: { [Op.lt]: new Date() },
    },
    limit: 100,
  });

  for (const order of stale) {
    const t = await db.transaction();
    try {
      const locked = await EventTicketOrder.findByPk(order.id, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (locked.status !== "pending") {
        await t.commit();
        continue;
      }
      await releaseTierReservation(locked.line_items, t);
      await locked.update({ status: "cancelled" }, { transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      console.error("Expire order error:", e.message);
    }
  }
}

export function buildFlutterwavePaymentPayload(order) {
  const publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY?.trim();
  return {
    provider: "flutterwave",
    tx_ref: order.transaction_ref,
    amount: parseFloat(order.total_amount).toFixed(2),
    currency: order.currency,
    public_key: publicKey || null,
    meta: {
      order_id: order.id,
      event_id: order.event_id,
      type: "event_ticket",
      buyer_email: order.buyer_email,
    },
  };
}
