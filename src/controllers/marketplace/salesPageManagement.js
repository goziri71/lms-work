/**
 * Sales Page Management Controller
 * Handles CRUD operations for product sales pages (tutor/admin)
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { ProductSalesPage } from "../../models/marketplace/productSalesPage.js";
import { Courses } from "../../models/course/courses.js";
import { EBooks } from "../../models/marketplace/ebooks.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { Community } from "../../models/marketplace/community.js";
import { Membership } from "../../models/marketplace/membership.js";
import { generateSlug, generateUniqueSlug } from "../../utils/slugGenerator.js";
import { Op } from "sequelize";

/**
 * Check if product exists and belongs to tutor
 */
async function verifyProductOwnership(productType, productId, tutorId, tutorType) {
  const ownerType = tutorType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  switch (productType) {
    case "course":
      const course = await Courses.findOne({
        where: {
          id: productId,
          owner_type: ownerType,
          owner_id: ownerId,
          is_marketplace: true,
        },
      });
      return !!course;

    case "ebook":
      const ebook = await EBooks.findOne({
        where: {
          id: productId,
          owner_type: ownerType,
          owner_id: ownerId,
        },
      });
      return !!ebook;

    case "digital_download":
      const download = await DigitalDownloads.findOne({
        where: {
          id: productId,
          owner_type: ownerType,
          owner_id: ownerId,
        },
      });
      return !!download;

    case "community":
      const community = await Community.findOne({
        where: {
          id: productId,
          tutor_id: ownerId,
          tutor_type: ownerType,
        },
      });
      return !!community;

    case "membership":
      const membership = await Membership.findOne({
        where: {
          id: productId,
          tutor_id: ownerId,
          tutor_type: ownerType,
        },
      });
      return !!membership;

    default:
      return false;
  }
}

/**
 * Create sales page for a product
 * POST /api/marketplace/tutor/sales-pages
 */
export const createSalesPage = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;
  const tutorType = userType === "sole_tutor" ? "sole_tutor" : "organization";

  const {
    product_type,
    product_id,
    title,
    hero_image_url,
    hero_video_url,
    content,
    features = [],
    testimonials = [],
    faq = [],
    call_to_action_text = "Get Started Now",
    call_to_action_url,
    meta_title,
    meta_description,
    status = "draft",
  } = req.body;

  // Validation
  if (!product_type || !product_id || !title) {
    throw new ErrorClass("product_type, product_id, and title are required", 400);
  }

  if (!["course", "ebook", "digital_download", "community", "membership"].includes(product_type)) {
    throw new ErrorClass("Invalid product_type", 400);
  }

  // Verify product ownership
  const ownsProduct = await verifyProductOwnership(productType, parseInt(product_id), tutorId, tutorType);
  if (!ownsProduct) {
    throw new ErrorClass("Product not found or you don't have permission to create a sales page for it", 403);
  }

  // Check if sales page already exists
  const existingPage = await ProductSalesPage.findOne({
    where: {
      product_type,
      product_id: parseInt(product_id),
    },
  });

  if (existingPage) {
    throw new ErrorClass("Sales page already exists for this product. Use update instead.", 400);
  }

  // Generate unique slug
  const baseSlug = generateSlug(title);
  const slug = await generateUniqueSlug(baseSlug, async (slug) => {
    const existing = await ProductSalesPage.findOne({ where: { slug } });
    return !!existing;
  });

  // Create sales page
  const salesPage = await ProductSalesPage.create({
    product_type,
    product_id: parseInt(product_id),
    slug,
    title: title.trim(),
    hero_image_url: hero_image_url || null,
    hero_video_url: hero_video_url || null,
    content: content || null,
    features: Array.isArray(features) ? features : [],
    testimonials: Array.isArray(testimonials) ? testimonials : [],
    faq: Array.isArray(faq) ? faq : [],
    call_to_action_text: call_to_action_text || "Get Started Now",
    call_to_action_url: call_to_action_url || null,
    meta_title: meta_title || null,
    meta_description: meta_description || null,
    status: status,
  });

  res.status(201).json({
    success: true,
    message: "Sales page created successfully",
    data: {
      sales_page: {
        id: salesPage.id,
        product_type: salesPage.product_type,
        product_id: salesPage.product_id,
        slug: salesPage.slug,
        title: salesPage.title,
        status: salesPage.status,
        public_url: `/api/marketplace/public/sales/${salesPage.slug}`,
      },
    },
  });
});

/**
 * Get sales page by ID
 * GET /api/marketplace/tutor/sales-pages/:id
 */
export const getSalesPage = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;
  const tutorType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const { id } = req.params;

  const salesPage = await ProductSalesPage.findByPk(id);

  if (!salesPage) {
    throw new ErrorClass("Sales page not found", 404);
  }

  // Verify product ownership
  const ownsProduct = await verifyProductOwnership(
    salesPage.product_type,
    salesPage.product_id,
    tutorId,
    tutorType
  );
  if (!ownsProduct) {
    throw new ErrorClass("You don't have permission to view this sales page", 403);
  }

  res.status(200).json({
    success: true,
    message: "Sales page retrieved successfully",
    data: {
      sales_page: salesPage,
    },
  });
});

/**
 * Get all sales pages for tutor
 * GET /api/marketplace/tutor/sales-pages
 */
export const getMySalesPages = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;
  const tutorType = userType === "sole_tutor" ? "sole_tutor" : "organization";

  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (status) {
    where.status = status;
  }

  // Get all products owned by tutor
  const ownerType = tutorType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  // Get sales pages and filter by product ownership
  const { count, rows: salesPages } = await ProductSalesPage.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["created_at", "DESC"]],
  });

  // Filter by ownership
  const ownedPages = [];
  for (const page of salesPages) {
    const ownsProduct = await verifyProductOwnership(page.product_type, page.product_id, tutorId, tutorType);
    if (ownsProduct) {
      ownedPages.push(page);
    }
  }

  res.status(200).json({
    success: true,
    message: "Sales pages retrieved successfully",
    data: {
      sales_pages: ownedPages,
      pagination: {
        total: ownedPages.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(ownedPages.length / parseInt(limit)),
      },
    },
  });
});

/**
 * Update sales page
 * PUT /api/marketplace/tutor/sales-pages/:id
 */
export const updateSalesPage = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;
  const tutorType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const { id } = req.params;

  const salesPage = await ProductSalesPage.findByPk(id);

  if (!salesPage) {
    throw new ErrorClass("Sales page not found", 404);
  }

  // Verify product ownership
  const ownsProduct = await verifyProductOwnership(
    salesPage.product_type,
    salesPage.product_id,
    tutorId,
    tutorType
  );
  if (!ownsProduct) {
    throw new ErrorClass("You don't have permission to update this sales page", 403);
  }

  const {
    title,
    hero_image_url,
    hero_video_url,
    content,
    features,
    testimonials,
    faq,
    call_to_action_text,
    call_to_action_url,
    meta_title,
    meta_description,
    status,
  } = req.body;

  const updateData = {};

  if (title !== undefined) {
    updateData.title = title.trim();
    // Regenerate slug if title changed
    if (title.trim() !== salesPage.title) {
      const baseSlug = generateSlug(title.trim());
      updateData.slug = await generateUniqueSlug(baseSlug, async (slug) => {
        const existing = await ProductSalesPage.findOne({ where: { slug, id: { [Op.ne]: id } } });
        return !!existing;
      });
    }
  }

  if (hero_image_url !== undefined) updateData.hero_image_url = hero_image_url;
  if (hero_video_url !== undefined) updateData.hero_video_url = hero_video_url;
  if (content !== undefined) updateData.content = content;
  if (features !== undefined) updateData.features = Array.isArray(features) ? features : [];
  if (testimonials !== undefined) updateData.testimonials = Array.isArray(testimonials) ? testimonials : [];
  if (faq !== undefined) updateData.faq = Array.isArray(faq) ? faq : [];
  if (call_to_action_text !== undefined) updateData.call_to_action_text = call_to_action_text;
  if (call_to_action_url !== undefined) updateData.call_to_action_url = call_to_action_url;
  if (meta_title !== undefined) updateData.meta_title = meta_title;
  if (meta_description !== undefined) updateData.meta_description = meta_description;
  if (status !== undefined) updateData.status = status;

  await salesPage.update(updateData);

  res.status(200).json({
    success: true,
    message: "Sales page updated successfully",
    data: {
      sales_page: salesPage,
    },
  });
});

/**
 * Delete sales page
 * DELETE /api/marketplace/tutor/sales-pages/:id
 */
export const deleteSalesPage = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;
  const tutorType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const { id } = req.params;

  const salesPage = await ProductSalesPage.findByPk(id);

  if (!salesPage) {
    throw new ErrorClass("Sales page not found", 404);
  }

  // Verify product ownership
  const ownsProduct = await verifyProductOwnership(
    salesPage.product_type,
    salesPage.product_id,
    tutorId,
    tutorType
  );
  if (!ownsProduct) {
    throw new ErrorClass("You don't have permission to delete this sales page", 403);
  }

  await salesPage.destroy();

  res.status(200).json({
    success: true,
    message: "Sales page deleted successfully",
  });
});
