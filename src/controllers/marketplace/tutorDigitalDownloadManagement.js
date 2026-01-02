import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { Op } from "sequelize";
import multer from "multer";
import { supabase } from "../../utils/supabase.js";

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
// First parse product_type field, then handle file upload based on product_type
export const uploadDigitalDownloadFileMiddleware = (req, res, next) => {
  // First, parse only the product_type field (not the file yet)
  const parseProductType = multer().fields([{ name: 'product_type', maxCount: 1 }]);
  
  parseProductType(req, res, (err) => {
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
    
    // Store product_type in req for later use
    req.product_type = product_type;
    
    // Now create the appropriate upload middleware based on product_type and parse the file
    const upload = createUploadMiddleware(product_type);
    upload.single("file")(req, res, next);
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
  const { product_type } = req.body;
  
  if (!product_type || !PRODUCT_TYPES[product_type]) {
    return next(new ErrorClass("Invalid product_type", 400));
  }
  
  const config = getProductTypeConfig(product_type);
  
  // Only allow preview for streaming products
  if (!config.streamingEnabled) {
    return next(new ErrorClass("Preview files are only allowed for streaming products (video, podcast, music)", 400));
  }
  
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: Math.min(config.maxSize, 100 * 1024 * 1024), // Max 100MB for preview
    },
    fileFilter: (req, file, cb) => {
      if (config.fileTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new ErrorClass(`Invalid preview file type for ${config.name}`, 400), false);
      }
    },
  });
  
  upload.single("preview_file")(req, res, next);
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
  const ownerId = tutorId;

  // Create digital download
  const download = await DigitalDownloads.create({
    title: title.trim(),
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
    category: category || null,
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
  if (title !== undefined) updateData.title = title.trim();
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
  if (category !== undefined) updateData.category = category;
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
  // product_type should already be parsed by the middleware and stored in req.product_type
  const product_type = req.product_type || req.body?.product_type;

  if (!req.file) {
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
  const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileExt = getFileExtension(req.file.mimetype);
  
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
      file_size: req.file.size,
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
  const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const objectPath = `tutors/${tutorId}/previews/${timestamp}_${sanitizedFileName}`;

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
    message: "Preview file uploaded successfully",
    data: {
      preview_url: fileUrl,
      file_path: objectPath,
    },
  });
});

