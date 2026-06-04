import multer from "multer";
import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TicketedEvent } from "../../models/marketplace/ticketedEvent.js";
import { EventTicketTier } from "../../models/marketplace/eventTicketTier.js";
import { EventTicketOrder } from "../../models/marketplace/eventTicketOrder.js";
import { EventTicket } from "../../models/marketplace/eventTicket.js";
import { getTutorInfo } from "./tutorLearnerManagement.js";
import { generateProductSlug } from "../../utils/slugGenerator.js";
import { supabase } from "../../utils/supabase.js";
import {
  assertEventOwnedByTutor,
  formatEventPublic,
  formatTierPublic,
  tierAvailable,
} from "../../services/eventTicketService.js";

const coverUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new ErrorClass("Only JPEG, PNG, and WebP images are allowed", 400), false);
  },
});

export const uploadEventCoverMiddleware = coverUploader.single("cover_image");

function mapEventSummary(event, tiers = []) {
  const sold = tiers.reduce((s, t) => s + t.quantity_sold, 0);
  const gross = tiers.reduce(
    (s, t) => s + parseFloat(t.price) * t.quantity_sold,
    0
  );
  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    format: event.format,
    status: event.status,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    timezone: event.timezone,
    cover_image_url: event.cover_image_url,
    category: event.category,
    tier_count: tiers.length,
    tickets_sold: sold,
    gross_revenue: gross.toFixed(2),
  };
}

export const uploadEventCover = TryCatchFunction(async (req, res) => {
  const { tutorId } = getTutorInfo(req);
  if (!req.file) throw new ErrorClass("Cover image file is required", 400);

  const bucket = process.env.EVENTS_BUCKET || "events";
  const timestamp = Date.now();
  const objectPath = `tutors/${tutorId}/covers/${timestamp}_${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new ErrorClass(`Upload failed: ${uploadError.message}`, 500);
  }

  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 31536000);

  let fileUrl;
  if (urlError) {
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    fileUrl = urlData.publicUrl;
  } else {
    fileUrl = signedUrlData.signedUrl;
  }

  res.status(200).json({
    success: true,
    message: "Cover image uploaded",
    data: { cover_image_url: fileUrl, file_path: objectPath },
  });
});

export const createEvent = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const {
    title,
    description,
    format,
    timezone,
    starts_at,
    ends_at,
    doors_open_at,
    venue_name,
    address_line1,
    city,
    region,
    country,
    latitude,
    longitude,
    online_url,
    cover_image_url,
    category,
    refund_policy,
    refund_policy_text,
    max_attendees,
    slug,
  } = req.body;

  if (!title || !format || !starts_at || !ends_at) {
    throw new ErrorClass("title, format, starts_at, and ends_at are required", 400);
  }

  const eventSlug = await generateProductSlug(
    slug || title,
    async (s) => !!(await TicketedEvent.findOne({ where: { slug: s } }))
  );

  const event = await TicketedEvent.create({
    owner_type: tutorType,
    owner_id: tutorId,
    title,
    description,
    slug: eventSlug,
    format,
    timezone: timezone || "Africa/Lagos",
    starts_at,
    ends_at,
    doors_open_at,
    venue_name,
    address_line1,
    city,
    region,
    country,
    latitude,
    longitude,
    online_url,
    cover_image_url,
    category,
    refund_policy: refund_policy || "none",
    refund_policy_text,
    max_attendees,
    status: "draft",
  });

  res.status(201).json({
    success: true,
    message: "Event created",
    data: { event: formatEventPublic(event) },
  });
});

export const listMyEvents = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { page = 1, limit = 20, status, search, format, from, to } = req.query;

  const where = { owner_type: tutorType, owner_id: tutorId };
  if (status) where.status = status;
  if (format) where.format = format;
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
    order: [["starts_at", "DESC"]],
  });

  const events = await Promise.all(
    rows.map(async (e) => {
      const tiers = await EventTicketTier.findAll({ where: { event_id: e.id } });
      return mapEventSummary(e, tiers);
    })
  );

  res.status(200).json({
    success: true,
    message: "Events retrieved",
    data: {
      events,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count,
        total_pages: Math.ceil(count / parseInt(limit, 10)),
      },
    },
  });
});

export const getEventById = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const tiers = await EventTicketTier.findAll({
    where: { event_id: event.id },
    order: [["sort_order", "ASC"], ["id", "ASC"]],
  });

  const recentOrders = await EventTicketOrder.findAll({
    where: { event_id: event.id, status: "paid" },
    limit: 10,
    order: [["paid_at", "DESC"]],
    attributes: [
      "id",
      "buyer_name",
      "buyer_email",
      "total_amount",
      "currency",
      "ticket_count",
      "paid_at",
    ],
  });

  res.status(200).json({
    success: true,
    data: {
      event: { ...formatEventPublic(event, { includeOnlineUrl: true }), tiers: tiers.map((t) => ({
        ...formatTierPublic(t),
        quantity_total: t.quantity_total,
        quantity_sold: t.quantity_sold,
        quantity_reserved: t.quantity_reserved,
      })) },
      recent_orders: recentOrders,
    },
  });
});

export const updateEvent = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const allowed = [
    "title", "description", "format", "timezone", "starts_at", "ends_at",
    "doors_open_at", "venue_name", "address_line1", "city", "region", "country",
    "latitude", "longitude", "online_url", "cover_image_url", "category",
    "refund_policy", "refund_policy_text", "max_attendees",
  ];

  for (const key of allowed) {
    if (req.body[key] !== undefined) event[key] = req.body[key];
  }

  if (req.body.slug && req.body.slug !== event.slug) {
    const newSlug = await generateProductSlug(req.body.slug, async (s) => {
      const existing = await TicketedEvent.findOne({ where: { slug: s } });
      return existing && existing.id !== event.id;
    });
    event.slug = newSlug;
  }

  await event.save();

  res.status(200).json({
    success: true,
    message: "Event updated",
    data: { event: formatEventPublic(event, { includeOnlineUrl: true }) },
  });
});

export const publishEvent = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const tierCount = await EventTicketTier.count({ where: { event_id: event.id } });
  if (tierCount === 0) {
    throw new ErrorClass("Add at least one ticket tier before publishing", 400);
  }

  const tiers = await EventTicketTier.findAll({ where: { event_id: event.id } });
  const hasInventory = tiers.some((t) => t.quantity_total > 0);
  if (!hasInventory) {
    throw new ErrorClass("Tiers must have quantity_total > 0", 400);
  }

  await event.update({ status: "published" });

  res.status(200).json({
    success: true,
    message: "Event published",
    data: { event: formatEventPublic(event) },
  });
});

export const unpublishEvent = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  await event.update({ status: "draft" });

  res.status(200).json({
    success: true,
    message: "Event unpublished",
    data: { event: formatEventPublic(event) },
  });
});

export const cancelEvent = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  await event.update({ status: "cancelled" });

  res.status(200).json({
    success: true,
    message: "Event cancelled",
    data: { event: formatEventPublic(event) },
  });
});

export const createTier = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const eventId = parseInt(req.params.eventId, 10);
  const event = await TicketedEvent.findByPk(eventId);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const {
    name,
    description,
    price,
    currency,
    quantity_total,
    max_per_order,
    sales_start,
    sales_end,
    sort_order,
    is_hidden,
  } = req.body;

  if (!name || quantity_total == null) {
    throw new ErrorClass("name and quantity_total are required", 400);
  }

  const tier = await EventTicketTier.create({
    event_id: eventId,
    name,
    description,
    price: price ?? 0,
    currency: currency || "NGN",
    quantity_total: parseInt(quantity_total, 10),
    max_per_order: max_per_order ?? 4,
    sales_start,
    sales_end,
    sort_order: sort_order ?? 0,
    is_hidden: !!is_hidden,
  });

  res.status(201).json({
    success: true,
    message: "Tier created",
    data: { tier: formatTierPublic(tier) },
  });
});

export const listTiers = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.eventId);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const tiers = await EventTicketTier.findAll({
    where: { event_id: event.id },
    order: [["sort_order", "ASC"], ["id", "ASC"]],
  });

  res.status(200).json({
    success: true,
    data: {
      tiers: tiers.map((t) => ({
        ...formatTierPublic(t),
        quantity_total: t.quantity_total,
        quantity_sold: t.quantity_sold,
        quantity_reserved: t.quantity_reserved,
      })),
    },
  });
});

export const updateTier = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.eventId);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const tier = await EventTicketTier.findOne({
    where: { id: req.params.tierId, event_id: event.id },
  });
  if (!tier) throw new ErrorClass("Tier not found", 404);

  if (req.body.quantity_total != null) {
    const newTotal = parseInt(req.body.quantity_total, 10);
    const minTotal = tier.quantity_sold + tier.quantity_reserved;
    if (newTotal < minTotal) {
      throw new ErrorClass(
        `quantity_total cannot be less than sold+reserved (${minTotal})`,
        400
      );
    }
    tier.quantity_total = newTotal;
  }

  const fields = [
    "name", "description", "price", "currency", "max_per_order",
    "sales_start", "sales_end", "sort_order", "is_hidden",
  ];
  for (const f of fields) {
    if (req.body[f] !== undefined) tier[f] = req.body[f];
  }

  await tier.save();

  res.status(200).json({
    success: true,
    message: "Tier updated",
    data: { tier: formatTierPublic(tier) },
  });
});

export const deleteTier = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.eventId);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const tier = await EventTicketTier.findOne({
    where: { id: req.params.tierId, event_id: event.id },
  });
  if (!tier) throw new ErrorClass("Tier not found", 404);
  if (tier.quantity_sold > 0) {
    throw new ErrorClass("Cannot delete tier with sold tickets", 400);
  }

  await tier.destroy();

  res.status(200).json({
    success: true,
    message: "Tier deleted",
  });
});

export const getEventSales = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const tiers = await EventTicketTier.findAll({ where: { event_id: event.id } });
  const paidOrders = await EventTicketOrder.findAll({
    where: { event_id: event.id, status: "paid" },
  });

  let gross = 0;
  let freeRsvp = 0;
  let paidCount = 0;
  for (const o of paidOrders) {
    const amt = parseFloat(o.total_amount);
    if (amt > 0) {
      gross += amt;
      paidCount++;
    } else {
      freeRsvp += o.ticket_count;
    }
  }

  const byTier = tiers.map((t) => ({
    tier_id: t.id,
    tier_name: t.name,
    tickets_sold: t.quantity_sold,
    gross_revenue: (parseFloat(t.price) * t.quantity_sold).toFixed(2),
  }));

  res.status(200).json({
    success: true,
    data: {
      summary: {
        orders_count: paidOrders.length,
        tickets_sold: tiers.reduce((s, t) => s + t.quantity_sold, 0),
        gross_revenue: gross.toFixed(2),
        currency: tiers[0]?.currency || "NGN",
        free_rsvp_count: freeRsvp,
        paid_order_count: paidCount,
        commission_status: "pending_config",
      },
      by_tier: byTier,
    },
  });
});

export const listAttendees = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const { page = 1, limit = 50, tier_id, checked_in } = req.query;
  const where = { event_id: event.id, status: { [Op.ne]: "cancelled" } };
  if (tier_id) where.tier_id = parseInt(tier_id, 10);
  if (checked_in === "true") where.status = "used";
  if (checked_in === "false") where.status = "valid";

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await EventTicket.findAndCountAll({
    where,
    include: [{ model: EventTicketTier, as: "tier", attributes: ["name"] }],
    limit: parseInt(limit, 10),
    offset,
    order: [["created_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    data: {
      items: rows.map((t) => ({
        ticket_id: t.id,
        ticket_code: t.ticket_code,
        status: t.status,
        tier_name: t.tier?.name,
        holder_name: t.holder_name,
        holder_email: t.holder_email,
        order_id: t.order_id,
        purchased_at: t.created_at,
        checked_in_at: t.checked_in_at,
      })),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count,
        total_pages: Math.ceil(count / parseInt(limit, 10)),
      },
    },
  });
});

export const exportAttendeesCsv = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const tickets = await EventTicket.findAll({
    where: { event_id: event.id, status: { [Op.ne]: "cancelled" } },
    include: [{ model: EventTicketTier, as: "tier", attributes: ["name"] }],
    order: [["created_at", "ASC"]],
  });

  const header = "ticket_code,tier,holder_name,holder_email,status,checked_in_at\n";
  const rows = tickets
    .map(
      (t) =>
        `"${t.ticket_code}","${t.tier?.name || ""}","${t.holder_name}","${t.holder_email}","${t.status}","${t.checked_in_at || ""}"`
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="event-${event.id}-attendees.csv"`
  );
  res.send(header + rows);
});

export const listEventOrders = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const { page = 1, limit = 20, status } = req.query;
  const where = { event_id: event.id };
  if (status) where.status = status;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await EventTicketOrder.findAndCountAll({
    where,
    limit: parseInt(limit, 10),
    offset,
    order: [["created_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    data: {
      orders: rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count,
        total_pages: Math.ceil(count / parseInt(limit, 10)),
      },
    },
  });
});
