import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TicketedEvent } from "../../models/marketplace/ticketedEvent.js";
import { EventTicketCoupon } from "../../models/marketplace/eventTicketCoupon.js";
import { getTutorInfo } from "./tutorLearnerManagement.js";
import {
  assertEventOwnedByTutor,
  validateOrderItems,
} from "../../services/eventTicketService.js";
import {
  applyCouponToOrderPricing,
  formatCouponPublic,
  generateCouponCode,
  normalizeCouponDiscount,
  normalizeCodeForCreate,
  parseTierIds,
} from "../../services/eventCouponService.js";

async function loadOwnedEvent(eventId, req) {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(eventId);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);
  return event;
}

export const listEventCoupons = TryCatchFunction(async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  await loadOwnedEvent(eventId, req);

  const coupons = await EventTicketCoupon.findAll({
    where: { event_id: eventId },
    order: [["created_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    data: { coupons: coupons.map(formatCouponPublic) },
  });
});

export const createEventCoupon = TryCatchFunction(async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  await loadOwnedEvent(eventId, req);

  const { discount_type, discount_value } = normalizeCouponDiscount(req.body);
  let code = req.body.code
    ? normalizeCodeForCreate(req.body.code)
    : generateCouponCode();
  if (!code) throw new ErrorClass("code is required", 400);

  const existing = await EventTicketCoupon.findOne({
    where: { event_id: eventId, code },
  });
  if (existing) {
    if (!req.body.code) {
      code = generateCouponCode();
    } else {
      throw new ErrorClass("A coupon with this code already exists", 409);
    }
  }

  const maxUses =
    req.body.max_uses === undefined || req.body.max_uses === null || req.body.max_uses === ""
      ? null
      : parseInt(req.body.max_uses, 10);
  if (maxUses != null && (Number.isNaN(maxUses) || maxUses < 1)) {
    throw new ErrorClass("max_uses must be at least 1", 400);
  }

  const coupon = await EventTicketCoupon.create({
    event_id: eventId,
    code,
    discount_type,
    discount_value,
    max_uses: maxUses,
    one_per_email:
      req.body.one_per_email === undefined
        ? true
        : req.body.one_per_email === true || req.body.one_per_email === "true",
    tier_ids: parseTierIds(req.body.tier_ids),
    starts_at: req.body.starts_at || null,
    ends_at: req.body.ends_at || null,
    is_active: req.body.is_active !== false && req.body.is_active !== "false",
  });

  res.status(201).json({
    success: true,
    message: "Coupon created",
    data: { coupon: formatCouponPublic(coupon) },
  });
});

export const updateEventCoupon = TryCatchFunction(async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  const couponId = parseInt(req.params.couponId, 10);
  await loadOwnedEvent(eventId, req);

  const coupon = await EventTicketCoupon.findOne({
    where: { id: couponId, event_id: eventId },
  });
  if (!coupon) throw new ErrorClass("Coupon not found", 404);

  if (req.body.discount_type !== undefined || req.body.discount_value !== undefined) {
    const d = normalizeCouponDiscount({
      discount_type: req.body.discount_type ?? coupon.discount_type,
      discount_value: req.body.discount_value ?? coupon.discount_value,
    });
    coupon.discount_type = d.discount_type;
    coupon.discount_value = d.discount_value;
  }

  if (req.body.max_uses !== undefined) {
    const maxUses =
      req.body.max_uses === null || req.body.max_uses === ""
        ? null
        : parseInt(req.body.max_uses, 10);
    if (maxUses != null && maxUses < coupon.uses_count) {
      throw new ErrorClass(
        `max_uses cannot be less than current uses (${coupon.uses_count})`,
        400
      );
    }
    coupon.max_uses = maxUses;
  }

  if (req.body.one_per_email !== undefined) {
    coupon.one_per_email =
      req.body.one_per_email === true || req.body.one_per_email === "true";
  }
  if (req.body.tier_ids !== undefined) {
    coupon.tier_ids = parseTierIds(req.body.tier_ids);
  }
  if (req.body.starts_at !== undefined) coupon.starts_at = req.body.starts_at || null;
  if (req.body.ends_at !== undefined) coupon.ends_at = req.body.ends_at || null;
  if (req.body.is_active !== undefined) {
    coupon.is_active =
      req.body.is_active === true || req.body.is_active === "true";
  }

  await coupon.save();

  res.status(200).json({
    success: true,
    message: "Coupon updated",
    data: { coupon: formatCouponPublic(coupon) },
  });
});

export const deleteEventCoupon = TryCatchFunction(async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  const couponId = parseInt(req.params.couponId, 10);
  await loadOwnedEvent(eventId, req);

  const coupon = await EventTicketCoupon.findOne({
    where: { id: couponId, event_id: eventId },
  });
  if (!coupon) throw new ErrorClass("Coupon not found", 404);

  if (coupon.uses_count > 0) {
    await coupon.update({ is_active: false });
    return res.status(200).json({
      success: true,
      message: "Coupon deactivated (already used)",
      data: { coupon: formatCouponPublic(coupon) },
    });
  }

  await coupon.destroy();
  res.status(200).json({
    success: true,
    message: "Coupon deleted",
  });
});

/** Preview coupon + stacked pricing at checkout */
export const validateEventCoupon = TryCatchFunction(async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (!eventId) throw new ErrorClass("Invalid event ID", 400);

  const event = await TicketedEvent.findByPk(eventId);
  if (!event) throw new ErrorClass("Event not found", 404);
  if (event.status !== "published") {
    throw new ErrorClass("Event is not available for ticket sales", 400);
  }

  const { coupon_code, buyer_email, items } = req.body;
  const { lineItems, totalTickets, currency } = await validateOrderItems(
    eventId,
    items
  );

  const tierSubtotal = lineItems.reduce(
    (s, li) => s + parseFloat(li.subtotal),
    0
  );

  const applied = await applyCouponToOrderPricing({
    eventId,
    couponCode: coupon_code,
    buyerEmail: buyer_email,
    lineItems,
  });

  res.status(200).json({
    success: true,
    data: {
      valid: !!applied.coupon,
      coupon: applied.coupon ? formatCouponPublic(applied.coupon) : null,
      pricing: {
        currency,
        ticket_count: totalTickets,
        tier_subtotal: tierSubtotal.toFixed(2),
        tier_discount_total: lineItems
          .reduce((s, li) => s + parseFloat(li.discount_amount || 0), 0)
          .toFixed(2),
        coupon_discount: (applied.couponDiscount || 0).toFixed(2),
        total_amount: applied.totalAmount.toFixed(2),
      },
      line_items: applied.lineItems,
    },
  });
});
