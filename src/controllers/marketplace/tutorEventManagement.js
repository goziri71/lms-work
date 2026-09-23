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
  normalizeTierBenefits,
  normalizeDiscountFields,
  approveEventOrder,
  rejectEventOrder,
} from "../../services/eventTicketService.js";
import { logEventActivity, actorFromReq } from "../../services/eventActivityService.js";

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
    sales_open: event.sales_open !== false,
    sales_status: event.sales_open === false ? "closed" : "open",
    requires_approval: !!event.requires_approval,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    timezone: event.timezone,
    cover_image_url: event.cover_image_url,
    video_url: event.video_url || null,
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

  // Ensure bucket exists (create if missing — same pattern as communities/memberships)
  try {
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets();
    if (!listError) {
      const bucketExists = buckets?.some((b) => b.name === bucket);
      if (!bucketExists) {
        const { error: createError } = await supabase.storage.createBucket(
          bucket,
          {
            public: true,
            allowedMimeTypes: [
              "image/jpeg",
              "image/jpg",
              "image/png",
              "image/webp",
            ],
            fileSizeLimit: 5 * 1024 * 1024,
          }
        );
        if (createError) {
          throw new ErrorClass(
            `Storage bucket "${bucket}" does not exist and could not be created. Create it in Supabase Storage (or set EVENTS_BUCKET). Error: ${createError.message}`,
            500
          );
        }
      }
    }
  } catch (error) {
    if (error instanceof ErrorClass) throw error;
    console.warn("Could not verify events bucket:", error.message);
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    if (
      uploadError.message?.includes("Bucket not found") ||
      uploadError.message?.includes("not found")
    ) {
      throw new ErrorClass(
        `Storage bucket "${bucket}" not found. Create a public bucket named "${bucket}" in Supabase Storage, or set EVENTS_BUCKET to an existing bucket.`,
        500
      );
    }
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
    video_url,
    category,
    refund_policy,
    refund_policy_text,
    max_attendees,
    slug,
    requires_approval,
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
    video_url: video_url || null,
    category,
    refund_policy: refund_policy || "none",
    refund_policy_text,
    max_attendees,
    status: "draft",
    sales_open: true,
    requires_approval: !!requires_approval,
  });

  const actor = actorFromReq(req);
  logEventActivity({
    eventId: event.id,
    action: "event_created",
    ...actor,
    metadata: { title: event.title, requires_approval: !!event.requires_approval },
  }).catch(() => {});

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
    "latitude", "longitude", "online_url", "cover_image_url", "video_url",
    "category", "refund_policy", "refund_policy_text", "max_attendees",
    "requires_approval",
  ];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === "requires_approval") {
        event[key] = !!req.body[key];
      } else {
        event[key] = req.body[key];
      }
    }
  }

  if (req.body.slug && req.body.slug !== event.slug) {
    const newSlug = await generateProductSlug(req.body.slug, async (s) => {
      const existing = await TicketedEvent.findOne({ where: { slug: s } });
      return existing && existing.id !== event.id;
    });
    event.slug = newSlug;
  }

  await event.save();

  logEventActivity({
    eventId: event.id,
    action: "event_updated",
    ...actorFromReq(req),
    metadata: { fields: Object.keys(req.body || {}) },
  }).catch(() => {});

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

  await event.update({ status: "published", sales_open: true });
  logEventActivity({
    eventId: event.id,
    action: "published",
    ...actorFromReq(req),
  }).catch(() => {});

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

  await event.update({ status: "draft", sales_open: false });
  logEventActivity({
    eventId: event.id,
    action: "unpublished",
    ...actorFromReq(req),
  }).catch(() => {});

  res.status(200).json({
    success: true,
    message: "Event unpublished",
    data: { event: formatEventPublic(event) },
  });
});

/** Close ticket sales without unpublishing (event page still visible). */
export const closeEventSales = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  await event.update({ sales_open: false });
  logEventActivity({
    eventId: event.id,
    action: "sales_closed",
    ...actorFromReq(req),
  }).catch(() => {});

  res.status(200).json({
    success: true,
    message: "Ticket sales closed",
    data: { event: formatEventPublic(event) },
  });
});

/** Re-open ticket sales (event must be published). */
export const openEventSales = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  if (event.status !== "published") {
    throw new ErrorClass("Publish the event before opening sales", 400);
  }

  await event.update({ sales_open: true });
  logEventActivity({
    eventId: event.id,
    action: "sales_opened",
    ...actorFromReq(req),
  }).catch(() => {});

  res.status(200).json({
    success: true,
    message: "Ticket sales opened",
    data: { event: formatEventPublic(event) },
  });
});

export const cancelEvent = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  await event.update({ status: "cancelled", sales_open: false });
  logEventActivity({
    eventId: event.id,
    action: "cancelled",
    ...actorFromReq(req),
  }).catch(() => {});

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
    benefits,
    price,
    currency,
    quantity_total,
    max_per_order,
    sales_start,
    sales_end,
    sort_order,
    is_hidden,
    discount_type,
    discount_value,
    discount_starts_at,
    discount_ends_at,
  } = req.body;

  if (!name || quantity_total == null) {
    throw new ErrorClass("name and quantity_total are required", 400);
  }

  // price is set by the creator (any amount incl. 0 for free); not platform-fixed
  const tierPrice =
    price === undefined || price === null || price === ""
      ? 0
      : parseFloat(price);
  if (Number.isNaN(tierPrice) || tierPrice < 0) {
    throw new ErrorClass("price must be a non-negative number set by you", 400);
  }

  const discount = normalizeDiscountFields(
    {
      discount_type,
      discount_value,
      discount_starts_at,
      discount_ends_at,
    },
    tierPrice
  );

  const tier = await EventTicketTier.create({
    event_id: eventId,
    name,
    description: description || null,
    benefits: normalizeTierBenefits(benefits),
    price: tierPrice,
    currency: currency || "NGN",
    quantity_total: parseInt(quantity_total, 10),
    max_per_order: max_per_order ?? 4,
    sales_start,
    sales_end,
    sort_order: sort_order ?? 0,
    is_hidden: !!is_hidden,
    ...discount,
  });

  logEventActivity({
    eventId: eventId,
    action: "tier_created",
    ...actorFromReq(req),
    metadata: {
      tier_id: tier.id,
      name: tier.name,
      price: parseFloat(tier.price),
      discount_type: tier.discount_type,
      discount_value: parseFloat(tier.discount_value || 0),
    },
  }).catch(() => {});

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
    "name", "description", "currency", "max_per_order",
    "sales_start", "sales_end", "sort_order", "is_hidden",
  ];
  for (const f of fields) {
    if (req.body[f] !== undefined) tier[f] = req.body[f];
  }

  if (req.body.benefits !== undefined) {
    tier.benefits = normalizeTierBenefits(req.body.benefits);
  }

  if (req.body.price !== undefined) {
    const tierPrice = parseFloat(req.body.price);
    if (Number.isNaN(tierPrice) || tierPrice < 0) {
      throw new ErrorClass("price must be a non-negative number set by you", 400);
    }
    tier.price = tierPrice;
  }

  const discountTouched =
    req.body.discount_type !== undefined ||
    req.body.discount_value !== undefined ||
    req.body.discount_starts_at !== undefined ||
    req.body.discount_ends_at !== undefined;

  if (discountTouched || req.body.price !== undefined) {
    const nextPrice = parseFloat(tier.price);
    const discount = normalizeDiscountFields(
      {
        discount_type:
          req.body.discount_type !== undefined
            ? req.body.discount_type
            : tier.discount_type,
        discount_value:
          req.body.discount_value !== undefined
            ? req.body.discount_value
            : tier.discount_value,
        discount_starts_at:
          req.body.discount_starts_at !== undefined
            ? req.body.discount_starts_at
            : tier.discount_starts_at,
        discount_ends_at:
          req.body.discount_ends_at !== undefined
            ? req.body.discount_ends_at
            : tier.discount_ends_at,
      },
      nextPrice
    );
    Object.assign(tier, discount);
  }

  await tier.save();

  logEventActivity({
    eventId: event.id,
    action: "tier_updated",
    ...actorFromReq(req),
    metadata: {
      tier_id: tier.id,
      name: tier.name,
      price: parseFloat(tier.price),
      discount_type: tier.discount_type,
      discount_value: parseFloat(tier.discount_value || 0),
    },
  }).catch(() => {});

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
        platform_fees: paidOrders
          .reduce((s, o) => s + parseFloat(o.platform_fee || 0), 0)
          .toFixed(2),
        creator_earnings: paidOrders
          .reduce((s, o) => s + parseFloat(o.tutor_earnings || 0), 0)
          .toFixed(2),
        discounts: paidOrders
          .reduce(
            (s, o) =>
              s +
              (Array.isArray(o.line_items)
                ? o.line_items.reduce(
                    (a, li) => a + parseFloat(li.discount_amount || 0),
                    0
                  )
                : 0),
            0
          )
          .toFixed(2),
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
    include: [
      { model: EventTicketTier, as: "tier", attributes: ["name"] },
      {
        model: EventTicketOrder,
        as: "order",
        attributes: ["buyer_name", "buyer_email", "buyer_phone"],
      },
    ],
    order: [["created_at", "ASC"]],
  });

  const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header =
    "ticket_code,tier,holder_name,holder_email,buyer_phone,status,checked_in_at\n";
  const rows = tickets
    .map((t) =>
      [
        t.ticket_code,
        t.tier?.name || "",
        t.holder_name,
        t.holder_email,
        t.order?.buyer_phone || "",
        t.status,
        t.checked_in_at || "",
      ]
        .map(csvEscape)
        .join(",")
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

/**
 * Approve a pending ticket application → allocate tickets
 * POST /tutor/events/:id/orders/:orderId/approve
 */
export const approveEventTicketOrder = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const orderId = parseInt(req.params.orderId, 10);
  const order = await EventTicketOrder.findByPk(orderId);
  if (!order || order.event_id !== event.id) {
    throw new ErrorClass("Order not found for this event", 404);
  }

  const { order: approved, tickets, alreadyApproved } = await approveEventOrder(
    orderId,
    {
      holderNames: req.body?.holder_names,
      approvedBy: tutorId,
    }
  );

  res.status(200).json({
    success: true,
    message: alreadyApproved ? "Order already approved" : "Order approved — tickets allocated",
    data: {
      order: {
        id: approved.id,
        status: approved.status,
        buyer_name: approved.buyer_name,
        buyer_email: approved.buyer_email,
        ticket_count: approved.ticket_count,
        total_amount: parseFloat(approved.total_amount).toFixed(2),
        currency: approved.currency,
      },
      tickets: tickets.map((t) => ({
        id: t.id,
        ticket_code: t.ticket_code,
        holder_name: t.holder_name,
        holder_email: t.holder_email,
        status: t.status,
      })),
    },
  });
});

/**
 * Reject a pending ticket application → release seats + refund if paid
 * POST /tutor/events/:id/orders/:orderId/reject
 */
export const rejectEventTicketOrder = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const event = await TicketedEvent.findByPk(req.params.id);
  if (!event) throw new ErrorClass("Event not found", 404);
  await assertEventOwnedByTutor(event, tutorId, tutorType);

  const orderId = parseInt(req.params.orderId, 10);
  const order = await EventTicketOrder.findByPk(orderId);
  if (!order || order.event_id !== event.id) {
    throw new ErrorClass("Order not found for this event", 404);
  }

  const reason = req.body?.reason || req.body?.rejection_reason || null;
  const { order: rejected, refund_status } = await rejectEventOrder(orderId, {
    reason,
  });

  res.status(200).json({
    success: true,
    message: "Order rejected",
    data: {
      order: {
        id: rejected.id,
        status: rejected.status,
        buyer_name: rejected.buyer_name,
        buyer_email: rejected.buyer_email,
        rejection_reason: rejected.rejection_reason,
      },
      refund_status,
    },
  });
});
