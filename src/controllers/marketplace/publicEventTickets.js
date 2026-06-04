import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TicketedEvent } from "../../models/marketplace/ticketedEvent.js";
import { EventTicketTier } from "../../models/marketplace/eventTicketTier.js";
import { EventTicketOrder } from "../../models/marketplace/eventTicketOrder.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import {
  formatEventPublic,
  formatTierPublic,
  getEventHost,
  isTierSalesOpen,
} from "../../services/eventTicketService.js";

export const browseEvents = TryCatchFunction(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    format,
    category,
    search,
    from,
    to,
    include_past,
  } = req.query;

  const where = { status: { [Op.in]: ["published", "sold_out"] } };
  if (format) where.format = format;
  if (category) where.category = category;
  if (!include_past || include_past === "false") {
    where.ends_at = { [Op.gte]: new Date() };
  }
  if (from || to) {
    where.starts_at = {};
    if (from) where.starts_at[Op.gte] = new Date(from);
    if (to) where.starts_at[Op.lte] = new Date(to);
  }
  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { slug: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await TicketedEvent.findAndCountAll({
    where,
    limit: parseInt(limit, 10),
    offset,
    order: [["starts_at", "ASC"]],
  });

  const items = await Promise.all(
    rows.map(async (event) => {
      const tiers = await EventTicketTier.findAll({
        where: { event_id: event.id, is_hidden: false },
      });
      const prices = tiers.map((t) => parseFloat(t.price));
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const remaining = tiers.reduce(
        (s, t) => s + Math.max(0, t.quantity_total - t.quantity_sold - t.quantity_reserved),
        0
      );
      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        format: event.format,
        starts_at: event.starts_at,
        timezone: event.timezone,
        cover_image_url: event.cover_image_url,
        venue_name: event.venue_name,
        city: event.city,
        country: event.country,
        min_price: minPrice.toFixed(2),
        currency: tiers[0]?.currency || "NGN",
        is_free_available: tiers.some((t) => parseFloat(t.price) === 0 && isTierSalesOpen(t)),
        tickets_remaining: remaining,
        status: event.status,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: {
      items,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count,
        total_pages: Math.ceil(count / parseInt(limit, 10)),
      },
    },
  });
});

export const getEventBySlug = TryCatchFunction(async (req, res) => {
  const event = await TicketedEvent.findOne({
    where: {
      slug: req.params.slug,
      status: { [Op.in]: ["published", "sold_out", "cancelled", "completed"] },
    },
  });

  if (!event) throw new ErrorClass("Event not found", 404);

  const tiers = await EventTicketTier.findAll({
    where: { event_id: event.id, is_hidden: false },
    order: [["sort_order", "ASC"], ["id", "ASC"]],
  });

  const host = await getEventHost(event.owner_type, event.owner_id);

  let ticketsOwned = 0;
  let existingOrderId = null;
  if (req.user?.userType === "student" && req.user?.id) {
    const orders = await EventTicketOrder.findAll({
      where: {
        event_id: event.id,
        student_id: req.user.id,
        status: "paid",
      },
    });
    ticketsOwned = orders.reduce((s, o) => s + o.ticket_count, 0);
    if (orders.length) existingOrderId = orders[0].id;
  }

  res.status(200).json({
    success: true,
    data: {
      event: formatEventPublic(event),
      tiers: tiers.map(formatTierPublic),
      host,
      user_context: {
        is_logged_in: !!req.user,
        existing_order_id: existingOrderId,
        tickets_owned: ticketsOwned,
      },
    },
  });
});

export const getTutorPublicEvents = TryCatchFunction(async (req, res) => {
  const { slug } = req.params;
  let ownerType;
  let ownerId;

  const tutor = await SoleTutor.findOne({
    where: { slug: slug.trim().toLowerCase(), status: "active" },
    attributes: ["id"],
  });
  if (!tutor) {
    throw new ErrorClass("Tutor not found", 404);
  }
  ownerType = "sole_tutor";
  ownerId = tutor.id;

  const events = await TicketedEvent.findAll({
    where: {
      owner_type: ownerType,
      owner_id: ownerId,
      status: { [Op.in]: ["published", "sold_out"] },
      ends_at: { [Op.gte]: new Date() },
    },
    order: [["starts_at", "ASC"]],
    limit: 50,
  });

  const items = await Promise.all(
    events.map(async (event) => {
      const tiers = await EventTicketTier.findAll({
        where: { event_id: event.id, is_hidden: false },
      });
      const prices = tiers.map((t) => parseFloat(t.price));
      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        format: event.format,
        starts_at: event.starts_at,
        cover_image_url: event.cover_image_url,
        min_price: prices.length ? Math.min(...prices).toFixed(2) : "0.00",
        currency: tiers[0]?.currency || "NGN",
      };
    })
  );

  res.status(200).json({
    success: true,
    data: { events: items },
  });
});
