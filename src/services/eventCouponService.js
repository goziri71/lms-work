import crypto from "crypto";
import { Op } from "sequelize";
import { ErrorClass } from "../utils/errorClass/index.js";
import { EventTicketCoupon } from "../models/marketplace/eventTicketCoupon.js";
import { EventTicketOrder } from "../models/marketplace/eventTicketOrder.js";

export function normalizeCouponCode(raw) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function generateCouponCode(prefix = "SAVE") {
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}${suffix}`.slice(0, 64);
}

export function normalizeCouponDiscount(body = {}) {
  const type = String(body.discount_type || "").toLowerCase();
  if (!["percent", "fixed"].includes(type)) {
    throw new ErrorClass("discount_type must be percent or fixed", 400);
  }
  const value = parseFloat(body.discount_value);
  if (Number.isNaN(value) || value <= 0) {
    throw new ErrorClass("discount_value must be a positive number", 400);
  }
  if (type === "percent" && value > 100) {
    throw new ErrorClass("percent discount cannot exceed 100", 400);
  }
  return { discount_type: type, discount_value: value };
}

function parseTierIds(raw) {
  if (raw == null || raw === "" || raw === "all") return null;
  const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw));
  const ids = arr.map((id) => parseInt(id, 10)).filter((n) => n > 0);
  return ids.length ? ids : null;
}

export function formatCouponPublic(coupon) {
  const maxUses = coupon.max_uses;
  const uses = coupon.uses_count || 0;
  return {
    id: coupon.id,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: parseFloat(coupon.discount_value),
    max_uses: maxUses,
    uses_count: uses,
    uses_remaining:
      maxUses == null ? null : Math.max(0, maxUses - uses),
    one_per_email: !!coupon.one_per_email,
    tier_ids: coupon.tier_ids || null,
    starts_at: coupon.starts_at,
    ends_at: coupon.ends_at,
    is_active: coupon.is_active !== false,
  };
}

function couponDateValid(coupon, now = new Date()) {
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return false;
  if (coupon.ends_at && new Date(coupon.ends_at) < now) return false;
  return true;
}

function tierEligibleForCoupon(coupon, tierId, unitPriceAfterTier) {
  if (!(unitPriceAfterTier > 0)) return false;
  const allowed = coupon.tier_ids;
  if (allowed?.length && !allowed.includes(tierId)) return false;
  return true;
}

async function emailAlreadyUsedCoupon(couponId, buyerEmail, excludeOrderId = null) {
  const now = new Date();
  const orders = await EventTicketOrder.findAll({
    where: {
      coupon_id: couponId,
      buyer_email: buyerEmail,
      ...(excludeOrderId ? { id: { [Op.ne]: excludeOrderId } } : {}),
    },
    attributes: ["id", "status", "reservation_expires_at", "coupon_consumed"],
  });

  for (const o of orders) {
    if (o.status === "paid" || o.status === "pending_approval") return true;
    if (o.coupon_consumed) return true;
    if (
      o.status === "pending" &&
      (!o.reservation_expires_at || new Date(o.reservation_expires_at) > now)
    ) {
      return true;
    }
  }
  return false;
}

export async function findCouponForEvent(eventId, codeRaw) {
  const code = normalizeCouponCode(codeRaw);
  if (!code) return null;
  return EventTicketCoupon.findOne({
    where: { event_id: eventId, code },
  });
}

/**
 * Validate coupon and compute order-level discount on top of tier pricing.
 * lineItems must already have unit_price (after tier discount) and subtotal.
 */
export async function applyCouponToOrderPricing({
  eventId,
  couponCode,
  buyerEmail,
  lineItems,
  now = new Date(),
}) {
  if (!couponCode || !String(couponCode).trim()) {
    return {
      coupon: null,
      couponDiscount: 0,
      lineItems,
      totalAmount: lineItems.reduce(
        (s, li) => s + parseFloat(li.subtotal),
        0
      ),
    };
  }

  const coupon = await findCouponForEvent(eventId, couponCode);
  if (!coupon || !coupon.is_active) {
    throw new ErrorClass("Invalid or inactive coupon code", 400);
  }
  if (!couponDateValid(coupon, now)) {
    throw new ErrorClass("This coupon is not valid at this time", 400);
  }
  if (
    coupon.max_uses != null &&
    coupon.uses_count >= coupon.max_uses
  ) {
    throw new ErrorClass("This coupon has reached its usage limit", 400);
  }

  const email = String(buyerEmail || "")
    .trim()
    .toLowerCase();
  if (coupon.one_per_email && email) {
    const used = await emailAlreadyUsedCoupon(coupon.id, email);
    if (used) {
      throw new ErrorClass("This coupon has already been used with this email", 400);
    }
  }

  let eligibleSubtotal = 0;
  for (const li of lineItems) {
    const unit = parseFloat(li.unit_price);
    const tierId = parseInt(li.tier_id, 10);
    if (tierEligibleForCoupon(coupon, tierId, unit)) {
      eligibleSubtotal += parseFloat(li.subtotal);
    }
  }

  if (eligibleSubtotal <= 0) {
    throw new ErrorClass(
      "This coupon does not apply to the selected ticket packages",
      400
    );
  }

  const type = coupon.discount_type;
  const value = parseFloat(coupon.discount_value);
  let couponDiscount =
    type === "percent"
      ? Math.round(((eligibleSubtotal * value) / 100) * 100) / 100
      : Math.min(value, eligibleSubtotal);

  couponDiscount = Math.round(couponDiscount * 100) / 100;
  const tierSubtotal = lineItems.reduce(
    (s, li) => s + parseFloat(li.subtotal),
    0
  );
  const totalAmount = Math.max(
    0,
    Math.round((tierSubtotal - couponDiscount) * 100) / 100
  );

  const enrichedLines = lineItems.map((li) => ({
    ...li,
    coupon_eligible: tierEligibleForCoupon(
      coupon,
      parseInt(li.tier_id, 10),
      parseFloat(li.unit_price)
    ),
  }));

  return {
    coupon,
    couponDiscount,
    lineItems: enrichedLines,
    totalAmount,
    tierSubtotal,
  };
}

export async function consumeCouponForOrder(order, transaction) {
  if (!order.coupon_id || order.coupon_consumed) return;

  const coupon = await EventTicketCoupon.findByPk(order.coupon_id, {
    lock: transaction.LOCK.UPDATE,
    transaction,
  });
  if (!coupon || !coupon.is_active) {
    throw new ErrorClass("Coupon is no longer valid", 400);
  }
  if (
    coupon.max_uses != null &&
    coupon.uses_count >= coupon.max_uses
  ) {
    throw new ErrorClass("Coupon usage limit reached", 409);
  }

  if (coupon.one_per_email && order.buyer_email) {
    const dup = await EventTicketOrder.findOne({
      where: {
        coupon_id: coupon.id,
        buyer_email: order.buyer_email,
        coupon_consumed: true,
        id: { [Op.ne]: order.id },
      },
      transaction,
    });
    if (dup) {
      throw new ErrorClass("Coupon already used with this email", 409);
    }
  }

  await coupon.update(
    { uses_count: coupon.uses_count + 1 },
    { transaction }
  );
  await order.update({ coupon_consumed: true }, { transaction });
}

export async function releaseCouponForOrder(order, transaction) {
  if (!order.coupon_id || !order.coupon_consumed) return;

  const coupon = await EventTicketCoupon.findByPk(order.coupon_id, {
    lock: transaction.LOCK.UPDATE,
    transaction,
  });
  if (coupon && coupon.uses_count > 0) {
    await coupon.update(
      { uses_count: coupon.uses_count - 1 },
      { transaction }
    );
  }
  await order.update({ coupon_consumed: false }, { transaction });
}

export { parseTierIds, normalizeCouponCode as normalizeCodeForCreate };
