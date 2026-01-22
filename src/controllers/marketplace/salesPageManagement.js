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
import multer from "multer";
import { supabase } from "../../utils/supabase.js";

// Configure multer for hero image uploads
const heroImageUploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ErrorClass("Only JPEG, PNG, and WebP images are allowed", 400), false);
    }
  },
});

// Configure multer for hero video uploads
const heroVideoUploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime",
      "video/x-msvideo", // .avi
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ErrorClass("Only MP4, WebM, OGG, MOV, and AVI videos are allowed", 400), false);
    }
  },
});

// Middleware exports
export const uploadHeroImageMiddleware = heroImageUploader.single("hero_image");
export const uploadHeroVideoMiddleware = heroVideoUploader.single("hero_video");

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

  // Validate status value
  const validStatuses = ["draft", "published"];
  const normalizedStatus = status ? String(status).toLowerCase().trim() : "draft";
  if (!validStatuses.includes(normalizedStatus)) {
    throw new ErrorClass(`Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
  }

  // Verify product ownership
  const ownsProduct = await verifyProductOwnership(product_type, parseInt(product_id), tutorId, tutorType);
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
    status: normalizedStatus,
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
  if (status !== undefined) {
    // Validate status value
    const validStatuses = ["draft", "published"];
    const normalizedStatus = String(status).toLowerCase().trim();
    if (!validStatuses.includes(normalizedStatus)) {
      throw new ErrorClass(`Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
    }
    updateData.status = normalizedStatus;
  }

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

/**
 * Upload hero image for sales page
 * POST /api/marketplace/tutor/sales-pages/upload-hero-image
 * Returns the image URL that can be used in hero_image_url field
 */
export const uploadHeroImage = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const tutorId = tutor.id;

  if (!req.file) {
    throw new ErrorClass("Hero image file is required", 400);
  }

  const bucket = process.env.SALES_PAGES_BUCKET || "sales-pages";
  
  // Check if bucket exists, create if it doesn't
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (!listError) {
      const bucketExists = buckets?.some((b) => b.name === bucket);
      if (!bucketExists) {
        // Try to create the bucket
        const { error: createError } = await supabase.storage.createBucket(bucket, {
          public: true, // Public bucket for sales page media
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'],
        });
        if (createError) {
          console.error(`Failed to create bucket "${bucket}":`, createError.message);
          throw new ErrorClass(
            `Storage bucket "${bucket}" does not exist. Please create it in Supabase Storage settings. Error: ${createError.message}`,
            500
          );
        } else {
          console.log(`✅ Created bucket "${bucket}"`);
        }
      }
    }
  } catch (error) {
    if (error instanceof ErrorClass) {
      throw error;
    }
    // If bucket check fails, continue and let upload error handle it
    console.warn("Could not verify bucket existence:", error.message);
  }

  const timestamp = Date.now();
  const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const ext = req.file.mimetype?.split("/")[1] || "jpg";
  const objectPath = `tutors/${tutorId}/hero-images/${timestamp}_${sanitizedFileName}`;

  // Upload to Supabase
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("not found")) {
      throw new ErrorClass(
        `Storage bucket "${bucket}" does not exist. Please create a bucket named "${bucket}" in your Supabase Storage settings.`,
        500
      );
    }
    throw new ErrorClass(`Upload failed: ${uploadError.message}`, 500);
  }

  // Generate signed URL for private bucket (expires in 1 year)
  // For private buckets, signed URLs are required; for public buckets, this still works
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 31536000); // 1 year expiration

  let fileUrl;
  if (urlError) {
    // Fallback to public URL if signed URL fails (for public buckets)
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    fileUrl = urlData.publicUrl;
  } else {
    // Use signed URL for private bucket
    fileUrl = signedUrlData.signedUrl;
  }

  res.status(200).json({
    success: true,
    message: "Hero image uploaded successfully",
    data: {
      hero_image_url: fileUrl,
      file_path: objectPath,
    },
  });
});

/**
 * Upload hero video for sales page
 * POST /api/marketplace/tutor/sales-pages/upload-hero-video
 * Returns the video URL that can be used in hero_video_url field
 */
export const uploadHeroVideo = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const tutorId = tutor.id;

  if (!req.file) {
    throw new ErrorClass("Hero video file is required", 400);
  }

  const bucket = process.env.SALES_PAGES_BUCKET || "sales-pages";
  
  // Check if bucket exists, create if it doesn't
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (!listError) {
      const bucketExists = buckets?.some((b) => b.name === bucket);
      if (!bucketExists) {
        // Try to create the bucket
        const { error: createError } = await supabase.storage.createBucket(bucket, {
          public: true, // Public bucket for sales page media
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'],
        });
        if (createError) {
          console.error(`Failed to create bucket "${bucket}":`, createError.message);
          throw new ErrorClass(
            `Storage bucket "${bucket}" does not exist. Please create it in Supabase Storage settings. Error: ${createError.message}`,
            500
          );
        } else {
          console.log(`✅ Created bucket "${bucket}"`);
        }
      }
    }
  } catch (error) {
    if (error instanceof ErrorClass) {
      throw error;
    }
    // If bucket check fails, continue and let upload error handle it
    console.warn("Could not verify bucket existence:", error.message);
  }

  const timestamp = Date.now();
  const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const objectPath = `tutors/${tutorId}/hero-videos/${timestamp}_${sanitizedFileName}`;

  // Upload to Supabase
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("not found")) {
      throw new ErrorClass(
        `Storage bucket "${bucket}" does not exist. Please create a bucket named "${bucket}" in your Supabase Storage settings.`,
        500
      );
    }
    throw new ErrorClass(`Upload failed: ${uploadError.message}`, 500);
  }

  // Generate signed URL for private bucket (expires in 1 year)
  // For private buckets, signed URLs are required; for public buckets, this still works
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 31536000); // 1 year expiration

  let fileUrl;
  if (urlError) {
    // Fallback to public URL if signed URL fails (for public buckets)
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    fileUrl = urlData.publicUrl;
  } else {
    // Use signed URL for private bucket
    fileUrl = signedUrlData.signedUrl;
  }

  res.status(200).json({
    success: true,
    message: "Hero video uploaded successfully",
    data: {
      hero_video_url: fileUrl,
      file_path: objectPath,
    },
  });
});
