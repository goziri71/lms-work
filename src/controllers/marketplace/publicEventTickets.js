import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TicketedEvent } from "../../models/marketplace/ticketedEvent.js";
import { EventTicketTier } from "../../models/marketplace/eventTicketTier.js";
import { EventTicketOrder } from "../../models/marketplace/eventTicketOrder.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import {
  formatEventPublic,
  formatTierPublic,
  formatEventsAsDiscoveryCards,
  getEventHost,
  listRelatedEvents,
  summarizeVisibleTiers,
} from "../../services/eventTicketService.js";
import { recordEventPageView, actorFromReq } from "../../services/eventActivityService.js";

function parseExcludeIds(raw) {
  if (raw == null || raw === "") return [];
  return String(raw)
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export const browseEvents = TryCatchFunction(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    format,
    category,
    city,
    search,
    from,
    to,
    include_past,
    exclude,
    exclude_slug,
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

  const and = [];
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    and.push({
      [Op.or]: [
        { title: { [Op.iLike]: q } },
        { slug: { [Op.iLike]: q } },
        { city: { [Op.iLike]: q } },
        { venue_name: { [Op.iLike]: q } },
        { description: { [Op.iLike]: q } },
      ],
    });
  }
  if (city && String(city).trim()) {
    and.push({ city: { [Op.iLike]: `%${String(city).trim()}%` } });
  }
  const excludeIds = parseExcludeIds(exclude);
  if (excludeIds.length) {
    and.push({ id: { [Op.notIn]: excludeIds } });
  }
  if (exclude_slug && String(exclude_slug).trim()) {
    and.push({
      slug: { [Op.ne]: String(exclude_slug).trim().toLowerCase() },
    });
  }
  if (and.length) where[Op.and] = and;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await TicketedEvent.findAndCountAll({
    where,
    limit: parseInt(limit, 10),
    offset,
    order: [["starts_at", "ASC"]],
  });

  const items = await formatEventsAsDiscoveryCards(rows);

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

  const viewer = actorFromReq(req);
  recordEventPageView(event.id, {
    ...viewer,
    source: "public_page",
  }).catch(() => {});

  const stats = summarizeVisibleTiers(tiers);
  const otherEvents = await listRelatedEvents(event, { limit: 6 });

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
      event: {
        ...formatEventPublic(event),
        tickets_sold: stats.tickets_sold,
        tickets_remaining: stats.tickets_remaining,
        early_bird_ends_at: stats.early_bird_ends_at,
      },
      tiers: tiers.map(formatTierPublic),
      host,
      other_events: otherEvents,
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

  const normalizedSlug = slug.trim().toLowerCase();

  const tutor = await SoleTutor.findOne({
    where: { slug: normalizedSlug, status: "active" },
    attributes: ["id"],
  });
  if (tutor) {
    ownerType = "sole_tutor";
    ownerId = tutor.id;
  } else {
    const org = await Organization.findOne({
      where: { slug: normalizedSlug, status: "active" },
      attributes: ["id"],
    });
    if (!org) {
      throw new ErrorClass("Tutor not found", 404);
    }
    ownerType = "organization";
    ownerId = org.id;
  }

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

  const items = await formatEventsAsDiscoveryCards(events);

  res.status(200).json({
    success: true,
    data: { events: items },
  });
});
