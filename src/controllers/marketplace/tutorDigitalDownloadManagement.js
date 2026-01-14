import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { Op } from "sequelize";
import multer from "multer";
import { supabase } from "../../utils/supabase.js";
import { normalizeCategory, CATEGORIES } from "../../constants/categories.js";
import { generateDigitalDownloadSlug } from "../../utils/productSlugHelper.js";

// Product type configurations
const PRODUCT_TYPES = {
  ebook: {
    name: "Ebook",
    fileTypes: ["application/pdf", "application/epub+zip"],
    maxSize: 100 * 1024 * 1024, // 100MB
    streamingEnabled: false,
    downloadEnabled: true,
    defaultFileType: "PDF",
  },
  podcast: {
    name: "Podcast",
    fileTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/m4a", "audio/ogg"],
    maxSize: 500 * 1024 * 1024, // 500MB
    streamingEnabled: true,
    downloadEnabled: false,
    defaultFileType: "MP3",
  },
  video: {
    name: "Video",
    fileTypes: ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"],
    maxSize: 5 * 1024 * 1024 * 1024, // 5GB
    streamingEnabled: true,
    downloadEnabled: false,
    defaultFileType: "MP4",
  },
  music: {
    name: "Music",
    fileTypes: ["audio/mpeg", "audio/mp3", "audio/flac", "audio/wav", "audio/m4a"],
    maxSize: 100 * 1024 * 1024, // 100MB per track
    streamingEnabled: true,
    downloadEnabled: false,
    defaultFileType: "MP3",
  },
  art: {
    name: "Art",
    fileTypes: ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp", "application/postscript", "application/pdf"],
    maxSize: 500 * 1024 * 1024, // 500MB
    streamingEnabled: false,
    downloadEnabled: true,
    defaultFileType: "PNG",
  },
  article: {
    name: "Article",
    fileTypes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"],
    maxSize: 50 * 1024 * 1024, // 50MB
    streamingEnabled: false,
    downloadEnabled: true,
    defaultFileType: "PDF",
  },
  code: {
    name: "Code",
    fileTypes: ["application/zip", "application/x-tar", "application/gzip", "application/x-gzip"],
    maxSize: 500 * 1024 * 1024, // 500MB
    streamingEnabled: false,
    downloadEnabled: true,
    defaultFileType: "ZIP",
  },
  "2d_3d_files": {
    name: "2D/3D Files",
    fileTypes: ["application/octet-stream", "model/obj", "application/x-blender", "application/x-step"],
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    streamingEnabled: false,
    downloadEnabled: true,
    defaultFileType: "OBJ",
  },
};

// Helper function to get product type config
const getProductTypeConfig = (productType) => {
  return PRODUCT_TYPES[productType] || PRODUCT_TYPES.ebook;
};

// Helper function to get file extension from mimetype
const getFileExtension = (mimetype) => {
  const mimeMap = {
    "application/pdf": "pdf",
    "application/epub+zip": "epub",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/m4a": "m4a",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
    "video/webm": "webm",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/svg+xml": "svg",
    "image/webp": "webp",
    "application/postscript": "ps",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "application/zip": "zip",
    "application/x-tar": "tar",
    "application/gzip": "gz",
    "application/x-gzip": "gz",
    "application/octet-stream": "bin",
    "model/obj": "obj",
    "application/x-blender": "blend",
    "application/x-step": "step",
  };
  return mimeMap[mimetype] || "bin";
};

// Create dynamic multer configurations for each product type
const createUploadMiddleware = (productType) => {
  const config = getProductTypeConfig(productType);
  
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.maxSize,
    },
    fileFilter: (req, file, cb) => {
      if (config.fileTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new ErrorClass(
            `Invalid file type for ${config.name}. Allowed types: ${config.fileTypes.join(", ")}`,
            400
          ),
          false
        );
      }
    },
  });
};

// Generic file upload middleware (accepts product_type from request)
// Parse both product_type and file together, then validate
export const uploadDigitalDownloadFileMiddleware = (req, res, next) => {
  // Parse both fields together using multer
  const parseAll = multer().fields([
    { name: 'product_type', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ]);
  
  parseAll(req, res, (err) => {
    if (err) {
      return next(new ErrorClass(`Form parsing error: ${err.message}`, 400));
    }
    
    // Extract product_type from parsed body (could be string or array)
    let product_type = req.body?.product_type;
    if (Array.isArray(product_type)) {
      product_type = product_type[0];
    }
    
    if (!product_type || !PRODUCT_TYPES[product_type]) {
      return next(new ErrorClass(
        `Invalid or missing product_type. Must be one of: ${Object.keys(PRODUCT_TYPES).join(", ")}`,
        400
      ));
    }
    
    // Check if file was provided
    if (!req.files || !req.files.file || req.files.file.length === 0) {
      return next(new ErrorClass("File is required", 400));
    }
    
    const file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
    
    // Validate file type and size based on product_type
    const config = getProductTypeConfig(product_type);
    
    // Check file type
    if (!config.fileTypes.includes(file.mimetype)) {
      return next(new ErrorClass(
        `Invalid file type for ${config.name}. Allowed types: ${config.fileTypes.join(", ")}`,
        400
      ));
    }
    
    // Check file size
    if (file.size > config.maxSize) {
      const maxSizeMB = (config.maxSize / (1024 * 1024)).toFixed(2);
      return next(new ErrorClass(
        `File size exceeds maximum of ${maxSizeMB}MB for ${config.name}`,
        400
      ));
    }
    
    // Store product_type and file in req for controller to use
    req.product_type = product_type;
    req.file = file;
    
    next();
  });
};

// Cover/Preview image upload middleware
const uploadCoverImage = multer({
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

export const uploadCoverImageMiddleware = uploadCoverImage.single("cover_image");

// Preview file upload middleware (for videos/audio - trailer/preview)
const uploadPreviewFile = (req, res, next) => {
  // Parse both product_type and preview_file together
  const parseAll = multer().fields([
    { name: 'product_type', maxCount: 1 },
    { name: 'preview_file', maxCount: 1 }
  ]);
  
  parseAll(req, res, (err) => {
    if (err) {
      return next(new ErrorClass(`Form parsing error: ${err.message}`, 400));
    }
    
    // Extract product_type from parsed body (could be string or array)
    let product_type = req.body?.product_type;
    if (Array.isArray(product_type)) {
      product_type = product_type[0];
    }
    
    if (!product_type || !PRODUCT_TYPES[product_type]) {
      return next(new ErrorClass(
        `Invalid or missing product_type. Must be one of: ${Object.keys(PRODUCT_TYPES).join(", ")}`,
        400
      ));
    }
    
    const config = getProductTypeConfig(product_type);
    
    // Only allow preview for streaming products
    if (!config.streamingEnabled) {
      return next(new ErrorClass("Preview files are only allowed for streaming products (video, podcast, music)", 400));
    }
    
    // Check if preview_file was provided
    if (!req.files || !req.files.preview_file || req.files.preview_file.length === 0) {
      return next(new ErrorClass("Preview file is required", 400));
    }
    
    const previewFile = Array.isArray(req.files.preview_file) ? req.files.preview_file[0] : req.files.preview_file;
    
    // Validate file type
    if (!config.fileTypes.includes(previewFile.mimetype)) {
      return next(new ErrorClass(`Invalid preview file type for ${config.name}`, 400));
    }
    
    // Validate file size (max 100MB for preview)
    const maxPreviewSize = Math.min(config.maxSize, 100 * 1024 * 1024);
    if (previewFile.size > maxPreviewSize) {
      const maxSizeMB = (maxPreviewSize / (1024 * 1024)).toFixed(2);
      return next(new ErrorClass(`Preview file size exceeds maximum of ${maxSizeMB}MB`, 400));
    }
    
    // Store product_type and file in req for controller to use
    req.product_type = product_type;
    req.file = previewFile;
    
    next();
  });
};

export const uploadPreviewFileMiddleware = uploadPreviewFile;

/**
 * Get all digital downloads created by tutor
 * GET /api/marketplace/tutor/digital-downloads
 */
export const getMyDigitalDownloads = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const {
    page = 1,
    limit = 20,
    status,
    product_type,
    search,
  } = req.query;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const where = {
    owner_type: ownerType,
    owner_id: ownerId,
  };

  if (status) {
    where.status = status;
  }

  if (product_type) {
    where.product_type = product_type;
  }

  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { author: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows: downloads } = await DigitalDownloads.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["id", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Digital downloads retrieved successfully",
    data: {
      digital_downloads: downloads.map((download) => ({
        id: download.id,
        title: download.title,
        author: download.author,
        product_type: download.product_type,
        price: parseFloat(download.price || 0),
        currency: download.currency,
        cover_image: download.cover_image,
        category: download.category,
        tags: download.tags || [],
        status: download.status,
        sales_count: download.sales_count,
        duration: download.duration,
        file_size: download.file_size,
        streaming_enabled: download.streaming_enabled,
        download_enabled: download.download_enabled,
        created_at: download.created_at,
        updated_at: download.updated_at,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    },
  });
});

/**
 * Get single digital download details
 * GET /api/marketplace/tutor/digital-downloads/:id
 */
export const getDigitalDownloadById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const download = await DigitalDownloads.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
    },
  });

  if (!download) {
    throw new ErrorClass("Digital download not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Digital download retrieved successfully",
    data: {
      digital_download: {
        id: download.id,
        title: download.title,
        description: download.description,
        author: download.author,
        pages: download.pages,
        product_type: download.product_type,
        price: parseFloat(download.price || 0),
        currency: download.currency,
        file_url: download.file_url,
        file_type: download.file_type,
        file_size: download.file_size,
        cover_image: download.cover_image,
        preview_url: download.preview_url,
        category: download.category,
        tags: download.tags || [],
        status: download.status,
        sales_count: download.sales_count,
        duration: download.duration,
        dimensions: download.dimensions,
        resolution: download.resolution,
        streaming_enabled: download.streaming_enabled,
        download_enabled: download.download_enabled,
        created_at: download.created_at,
        updated_at: download.updated_at,
      },
    },
  });
});

/**
 * Create new digital download
 * POST /api/marketplace/tutor/digital-downloads
 */
export const createDigitalDownload = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const {
    title,
    description,
    author,
    pages,
    price,
    currency = "NGN",
    file_url,
    product_type = "ebook",
    category,
    tags = [],
    status = "draft",
    duration,
    dimensions,
    resolution,
    preview_url,
  } = req.body;

  // Validation
  if (!title || !file_url) {
    throw new ErrorClass("Title and file URL are required", 400);
  }

  if (!category) {
    throw new ErrorClass("Category is required", 400);
  }

  // Validate and normalize category
  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) {
    throw new ErrorClass(
      `Invalid category. Must be one of: ${CATEGORIES.join(", ")}`,
      400
    );
  }

  if (!PRODUCT_TYPES[product_type]) {
    throw new ErrorClass(
      `Invalid product_type. Must be one of: ${Object.keys(PRODUCT_TYPES).join(", ")}`,
      400
    );
  }

  if (status === "published" && (!price || parseFloat(price) < 0)) {
    throw new ErrorClass("Published products must have a price >= 0", 400);
  }

  const config = getProductTypeConfig(product_type);

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  let ownerId = tutorId;

  // Check subscription limits and expiration
  try {
    const { checkSubscriptionLimit, validateSubscriptionStatus } = await import("./tutorSubscription.js");
    
    // Determine tutor type and ID
    let tutorType;
    if (userType === "sole_tutor") {
      tutorType = "sole_tutor";
    } else if (userType === "organization" || userType === "organization_user") {
      tutorType = "organization";
      if (userType === "organization_user") {
        ownerId = tutor.organization_id;
      }
    } else {
      throw new ErrorClass("Invalid user type", 403);
    }

    // Check subscription status (expiration)
    const statusCheck = await validateSubscriptionStatus(ownerId, tutorType);
    if (!statusCheck.allowed) {
      throw new ErrorClass(statusCheck.reason, 403);
    }

    // Check subscription limit for digital downloads
    const limitCheck = await checkSubscriptionLimit(ownerId, tutorType, "digital_download");
    if (!limitCheck.allowed) {
      throw new ErrorClass(limitCheck.reason, 403);
    }
  } catch (error) {
    // If it's already an ErrorClass, rethrow it
    if (error instanceof ErrorClass) {
      throw error;
    }
    // If subscription tables don't exist, log warning but continue
    console.warn("Subscription check failed:", error.message);
  }

  // Generate unique slug
  const slug = await generateDigitalDownloadSlug(title.trim());

  // Create digital download
  const download = await DigitalDownloads.create({
    title: title.trim(),
    slug: slug,
    description: description || null,
    author: author || null,
    pages: pages ? parseInt(pages) : null,
    price: parseFloat(price || 0),
    currency: currency,
    file_url: file_url,
    file_type: req.body.file_type || config.defaultFileType,
    file_size: req.body.file_size ? parseInt(req.body.file_size) : null,
    cover_image: req.body.cover_image || null,
    preview_url: preview_url || null,
    category: normalizedCategory,
    tags: Array.isArray(tags) ? tags : [],
    product_type: product_type,
    owner_type: ownerType,
    owner_id: ownerId,
    status: status,
    duration: duration ? parseInt(duration) : null,
    dimensions: dimensions || null,
    resolution: resolution || null,
    streaming_enabled: config.streamingEnabled,
    download_enabled: config.downloadEnabled,
  });

  res.status(201).json({
    success: true,
    message: "Digital download created successfully",
    data: {
      digital_download: {
        id: download.id,
        title: download.title,
        product_type: download.product_type,
        price: parseFloat(download.price || 0),
        status: download.status,
      },
    },
  });
});

/**
 * Update digital download
 * PUT /api/marketplace/tutor/digital-downloads/:id
 */
export const updateDigitalDownload = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const download = await DigitalDownloads.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
    },
  });

  if (!download) {
    throw new ErrorClass("Digital download not found", 404);
  }

  const {
    title,
    description,
    author,
    pages,
    price,
    currency,
    file_url,
    file_type,
    file_size,
    cover_image,
    preview_url,
    category,
    tags,
    status,
    duration,
    dimensions,
    resolution,
  } = req.body;

  // Validation for published status
  if (status === "published") {
    const newPrice = price ? parseFloat(price) : parseFloat(download.price || 0);
    if (newPrice < 0) {
      throw new ErrorClass("Published products must have a price >= 0", 400);
    }
    if (!download.file_url && !file_url) {
      throw new ErrorClass("Cannot publish product without file", 400);
    }
  }

  // Update digital download
  const updateData = {};
  if (title !== undefined) {
    updateData.title = title.trim();
    // Regenerate slug if title changed
    if (title.trim() !== download.title) {
      updateData.slug = await generateDigitalDownloadSlug(title.trim(), download.id);
    }
  }
  if (description !== undefined) updateData.description = description;
  if (author !== undefined) updateData.author = author;
  if (pages !== undefined) updateData.pages = pages ? parseInt(pages) : null;
  if (price !== undefined) updateData.price = parseFloat(price);
  if (currency !== undefined) updateData.currency = currency;
  if (file_url !== undefined) updateData.file_url = file_url;
  if (file_type !== undefined) updateData.file_type = file_type;
  if (file_size !== undefined) updateData.file_size = file_size ? parseInt(file_size) : null;
  if (cover_image !== undefined) updateData.cover_image = cover_image;
  if (preview_url !== undefined) updateData.preview_url = preview_url;
  if (category !== undefined && category !== null) {
    const normalizedCategory = normalizeCategory(category);
    if (!normalizedCategory) {
      throw new ErrorClass(
        `Invalid category. Must be one of: ${CATEGORIES.join(", ")}`,
        400
      );
    }
    updateData.category = normalizedCategory;
  }
  if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
  if (status !== undefined) updateData.status = status;
  if (duration !== undefined) updateData.duration = duration ? parseInt(duration) : null;
  if (dimensions !== undefined) updateData.dimensions = dimensions;
  if (resolution !== undefined) updateData.resolution = resolution;

  await download.update(updateData);

  res.status(200).json({
    success: true,
    message: "Digital download updated successfully",
    data: {
      digital_download: {
        id: download.id,
        title: download.title,
        product_type: download.product_type,
        price: parseFloat(download.price || 0),
        status: download.status,
      },
    },
  });
});

/**
 * Delete digital download
 * DELETE /api/marketplace/tutor/digital-downloads/:id
 */
export const deleteDigitalDownload = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const download = await DigitalDownloads.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
    },
  });

  if (!download) {
    throw new ErrorClass("Digital download not found", 404);
  }

  // Check if product has sales
  if (download.sales_count > 0) {
    throw new ErrorClass(
      "Cannot delete product with existing sales. Unpublish the product instead.",
      400
    );
  }

  // Helper function to extract bucket and object path from Supabase URL
  const extractFileInfo = (url) => {
    if (!url || typeof url !== "string") return null;
    
    try {
      const urlParts = url.split("/storage/v1/object/");
      if (urlParts.length < 2) return null;
      
      const pathPart = urlParts[1].split("?")[0]; // Remove query params
      const pathParts = pathPart.split("/").filter(p => p); // Remove empty strings
      
      if (pathParts.length < 2) return null;
      
      return {
        bucket: pathParts[1], // Second element is the bucket
        objectPath: pathParts.slice(2).join("/"), // Path starts from third element
      };
    } catch (error) {
      console.warn("Error parsing file URL:", error);
      return null;
    }
  };

  // Delete files from Supabase storage
  const bucket = process.env.DIGITAL_DOWNLOADS_BUCKET || "digital-downloads";
  
  // Delete main file
  if (download.file_url) {
    try {
      const fileInfo = extractFileInfo(download.file_url);
      if (fileInfo && fileInfo.bucket && fileInfo.objectPath) {
        await supabase.storage.from(fileInfo.bucket).remove([fileInfo.objectPath]);
        console.log(`Deleted main file: ${fileInfo.objectPath}`);
      }
    } catch (error) {
      console.warn("Failed to remove main file from storage:", error?.message || error);
      // Continue with deletion even if file removal fails
    }
  }

  // Delete cover image
  if (download.cover_image) {
    try {
      const fileInfo = extractFileInfo(download.cover_image);
      if (fileInfo && fileInfo.bucket && fileInfo.objectPath) {
        await supabase.storage.from(fileInfo.bucket).remove([fileInfo.objectPath]);
        console.log(`Deleted cover image: ${fileInfo.objectPath}`);
      }
    } catch (error) {
      console.warn("Failed to remove cover image from storage:", error?.message || error);
      // Continue with deletion even if file removal fails
    }
  }

  // Delete preview file
  if (download.preview_url) {
    try {
      const fileInfo = extractFileInfo(download.preview_url);
      if (fileInfo && fileInfo.bucket && fileInfo.objectPath) {
        await supabase.storage.from(fileInfo.bucket).remove([fileInfo.objectPath]);
        console.log(`Deleted preview file: ${fileInfo.objectPath}`);
      }
    } catch (error) {
      console.warn("Failed to remove preview file from storage:", error?.message || error);
      // Continue with deletion even if file removal fails
    }
  }

  // Delete the database record
  await download.destroy();

  res.status(200).json({
    success: true,
    message: "Digital download deleted successfully",
  });
});

/**
 * Update digital download status (publish/unpublish)
 * PATCH /api/marketplace/tutor/digital-downloads/:id/status
 */
export const updateDigitalDownloadStatus = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  if (!["draft", "published"].includes(status)) {
    throw new ErrorClass("Invalid status. Must be 'draft' or 'published'", 400);
  }

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const download = await DigitalDownloads.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
    },
  });

  if (!download) {
    throw new ErrorClass("Digital download not found", 404);
  }

  // Validation for publishing
  if (status === "published") {
    const price = parseFloat(download.price || 0);
    if (price < 0) {
      throw new ErrorClass("Cannot publish product with invalid price", 400);
    }
    if (!download.file_url) {
      throw new ErrorClass("Cannot publish product without file", 400);
    }
  }

  await download.update({ status });

  res.status(200).json({
    success: true,
    message: `Digital download ${status === "published" ? "published" : "unpublished"} successfully`,
    data: {
      digital_download: {
        id: download.id,
        title: download.title,
        status: download.status,
      },
    },
  });
});

/**
 * Upload file for digital download
 * POST /api/marketplace/tutor/digital-downloads/upload-file
 */
export const uploadDigitalDownloadFile = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const tutorId = tutor.id;
  // product_type and file should already be parsed and validated by the middleware
  const product_type = req.product_type;
  const file = req.file;

  if (!file) {
    throw new ErrorClass("File is required", 400);
  }

  if (!product_type || !PRODUCT_TYPES[product_type]) {
    throw new ErrorClass(
      `Invalid product_type. Must be one of: ${Object.keys(PRODUCT_TYPES).join(", ")}`,
      400
    );
  }

  const config = getProductTypeConfig(product_type);
  const bucket = process.env.DIGITAL_DOWNLOADS_BUCKET || "digital-downloads";
  const timestamp = Date.now();
  const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileExt = getFileExtension(file.mimetype);
  
  // Organize by product type
  const folderMap = {
    ebook: "ebooks",
    podcast: "podcasts",
    video: "videos",
    music: "music",
    art: "art",
    article: "articles",
    code: "code",
    "2d_3d_files": "2d_3d_files",
  };
  
  const folder = folderMap[product_type] || "other";
  const objectPath = `tutors/${tutorId}/${folder}/${timestamp}_${sanitizedFileName}`;

  // Upload to Supabase
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new ErrorClass(`Upload failed: ${uploadError.message}`, 500);
  }

  // Generate signed URL for private bucket (expires in 1 year)
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 31536000); // 1 year expiration

  let fileUrl;
  if (urlError) {
    // Fallback to public URL if signed URL fails (for public buckets)
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(objectPath);
    fileUrl = urlData.publicUrl;
  } else {
    // Use signed URL for private bucket
    fileUrl = signedUrlData.signedUrl;
  }

  res.status(200).json({
    success: true,
    message: "File uploaded successfully",
    data: {
      file_url: fileUrl,
      file_path: objectPath,
      file_type: config.defaultFileType,
      file_size: file.size,
      product_type: product_type,
    },
  });
});

/**
 * Upload cover/preview image for digital download
 * POST /api/marketplace/tutor/digital-downloads/upload-cover
 */
export const uploadDigitalDownloadCover = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const tutorId = tutor.id;

  if (!req.file) {
    throw new ErrorClass("Cover image file is required", 400);
  }

  const bucket = process.env.DIGITAL_DOWNLOADS_BUCKET || "digital-downloads";
  const timestamp = Date.now();
  const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const ext = req.file.mimetype?.split("/")[1] || "jpg";
  const objectPath = `tutors/${tutorId}/covers/${timestamp}_${sanitizedFileName}`;

  // Upload to Supabase
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new ErrorClass(`Upload failed: ${uploadError.message}`, 500);
  }

  // Generate signed URL for private bucket (expires in 1 year)
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 31536000); // 1 year expiration

  let fileUrl;
  if (urlError) {
    // Fallback to public URL if signed URL fails (for public buckets)
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(objectPath);
    fileUrl = urlData.publicUrl;
  } else {
    // Use signed URL for private bucket
    fileUrl = signedUrlData.signedUrl;
  }

  res.status(200).json({
    success: true,
    message: "Cover image uploaded successfully",
    data: {
      cover_image: fileUrl,
      file_path: objectPath,
    },
  });
});

/**
 * Upload preview file (for videos/podcasts/music)
 * POST /api/marketplace/tutor/digital-downloads/upload-preview
 */
export const uploadDigitalDownloadPreview = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const tutorId = tutor.id;
  // product_type should already be parsed by the middleware and stored in req.product_type
  const product_type = req.product_type || req.body?.product_type;

  if (!req.file) {
    throw new ErrorClass("Preview file is required", 400);
  }

  if (!product_type || !PRODUCT_TYPES[product_type]) {
    throw new ErrorClass(
      `Invalid product_type. Must be one of: ${Object.keys(PRODUCT_TYPES).join(", ")}`,
      400
    );
  }

  const config = getProductTypeConfig(product_type);
  
  if (!config.streamingEnabled) {
    throw new ErrorClass("Preview files are only allowed for streaming products (video, podcast, music)", 400);
  }

  const bucket = process.env.DIGITAL_DOWNLOADS_BUCKET || "digital-downloads";
  const timestamp = Date.now();
  const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const objectPath = `tutors/${tutorId}/previews/${timestamp}_${sanitizedFileName}`;

  // Upload to Supabase
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new ErrorClass(`Upload failed: ${uploadError.message}`, 500);
  }

  // Generate signed URL for private bucket (expires in 1 year)
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 31536000); // 1 year expiration

  let fileUrl;
  if (urlError) {
    // Fallback to public URL if signed URL fails (for public buckets)
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(objectPath);
    fileUrl = urlData.publicUrl;
  } else {
    // Use signed URL for private bucket
    fileUrl = signedUrlData.signedUrl;
  }

  res.status(200).json({
    success: true,
    message: "Preview file uploaded successfully",
    data: {
      preview_url: fileUrl,
      file_path: objectPath,
    },
  });
});

