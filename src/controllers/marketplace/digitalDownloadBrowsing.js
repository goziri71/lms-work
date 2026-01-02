import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { DigitalDownloads, DigitalDownloadPurchase } from "../../models/marketplace/index.js";
import { SoleTutor, Organization } from "../../models/marketplace/index.js";
import { Op } from "sequelize";
import { supabase } from "../../utils/supabase.js";
import { db } from "../../database/database.js";

/**
 * Browse all published digital downloads
 * GET /api/marketplace/digital-downloads
 */
export const browseDigitalDownloads = TryCatchFunction(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    category,
    product_type,
    owner_id,
    owner_type,
    min_price,
    max_price,
    sort = "newest", // newest, oldest, price_low, price_high, popular
  } = req.query;

  const where = {
    status: "published",
  };

  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { author: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (category) {
    where.category = category;
  }

  if (product_type) {
    where.product_type = product_type;
  }

  if (owner_id && owner_type) {
    where.owner_id = parseInt(owner_id);
    where.owner_type = owner_type;
  }

  if (min_price || max_price) {
    where.price = {};
    if (min_price) {
      where.price[Op.gte] = parseFloat(min_price);
    }
    if (max_price) {
      where.price[Op.lte] = parseFloat(max_price);
    }
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Determine sort order
  let order = [["id", "DESC"]];
  if (sort === "oldest") {
    order = [["id", "ASC"]];
  } else if (sort === "price_low") {
    order = [["price", "ASC"]];
  } else if (sort === "price_high") {
    order = [["price", "DESC"]];
  } else if (sort === "popular") {
    order = [["sales_count", "DESC"]];
  }

  const { count, rows: downloads } = await DigitalDownloads.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order,
    include: [
      {
        model: SoleTutor,
        as: "soleTutor",
        attributes: ["id", "fname", "lname", "email"],
        required: false,
        on: db.Sequelize.literal(`"DigitalDownloads"."owner_id" = "soleTutor"."id" AND "DigitalDownloads"."owner_type" = 'sole_tutor'`),
      },
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "email"],
        required: false,
        on: db.Sequelize.literal(`"DigitalDownloads"."owner_id" = "organization"."id" AND "DigitalDownloads"."owner_type" = 'organization'`),
      },
    ],
  });

  // Format response
  const downloadsData = downloads.map((download) => {
    const downloadJson = download.toJSON();
    const owner = downloadJson.soleTutor || downloadJson.organization;
    
    return {
      id: downloadJson.id,
      title: downloadJson.title,
      description: downloadJson.description,
      author: downloadJson.author,
      pages: downloadJson.pages,
      product_type: downloadJson.product_type,
      price: parseFloat(downloadJson.price || 0),
      currency: downloadJson.currency,
      cover_image: downloadJson.cover_image,
      preview_url: downloadJson.preview_url,
      category: downloadJson.category,
      tags: downloadJson.tags || [],
      sales_count: downloadJson.sales_count,
      duration: downloadJson.duration,
      file_size: downloadJson.file_size,
      streaming_enabled: downloadJson.streaming_enabled,
      download_enabled: downloadJson.download_enabled,
      owner: owner
        ? {
            id: owner.id,
            name: owner.name || `${owner.fname || ""} ${owner.lname || ""}`.trim(),
            type: downloadJson.owner_type,
          }
        : null,
      created_at: downloadJson.created_at,
    };
  });

  res.status(200).json({
    success: true,
    message: "Digital downloads retrieved successfully",
    data: {
      digital_downloads: downloadsData,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

/**
 * Get single digital download details
 * GET /api/marketplace/digital-downloads/:id
 */
export const getDigitalDownloadById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const studentId = req.user?.id;

  const download = await DigitalDownloads.findOne({
    where: {
      id,
      status: "published",
    },
    include: [
      {
        model: SoleTutor,
        as: "soleTutor",
        attributes: ["id", "fname", "lname", "email", "bio"],
        required: false,
        on: db.Sequelize.literal(`"DigitalDownloads"."owner_id" = "soleTutor"."id" AND "DigitalDownloads"."owner_type" = 'sole_tutor'`),
      },
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "email", "description"],
        required: false,
        on: db.Sequelize.literal(`"DigitalDownloads"."owner_id" = "organization"."id" AND "DigitalDownloads"."owner_type" = 'organization'`),
      },
    ],
  });

  if (!download) {
    throw new ErrorClass("Digital download not found or not available", 404);
  }

  // Check if student has purchased this product
  let is_purchased = false;
  if (studentId && req.user?.userType === "student") {
    const purchase = await DigitalDownloadPurchase.findOne({
      where: {
        digital_download_id: id,
        student_id: studentId,
      },
    });
    is_purchased = !!purchase;
  }

  const downloadJson = download.toJSON();
  const owner = downloadJson.soleTutor || downloadJson.organization;

  res.status(200).json({
    success: true,
    message: "Digital download retrieved successfully",
    data: {
      digital_download: {
        id: downloadJson.id,
        title: downloadJson.title,
        description: downloadJson.description,
        author: downloadJson.author,
        pages: downloadJson.pages,
        product_type: downloadJson.product_type,
        price: parseFloat(downloadJson.price || 0),
        currency: downloadJson.currency,
        cover_image: downloadJson.cover_image,
        preview_url: downloadJson.preview_url,
        category: downloadJson.category,
        tags: downloadJson.tags || [],
        sales_count: downloadJson.sales_count,
        duration: downloadJson.duration,
        dimensions: downloadJson.dimensions,
        resolution: downloadJson.resolution,
        file_size: downloadJson.file_size,
        file_type: downloadJson.file_type,
        streaming_enabled: downloadJson.streaming_enabled,
        download_enabled: downloadJson.download_enabled,
        owner: owner
          ? {
              id: owner.id,
              name: owner.name || `${owner.fname || ""} ${owner.lname || ""}`.trim(),
              type: downloadJson.owner_type,
              bio: owner.bio || owner.description || null,
            }
          : null,
        is_purchased,
        created_at: downloadJson.created_at,
      },
    },
  });
});

/**
 * Get student's purchased digital downloads
 * GET /api/marketplace/digital-downloads/my-downloads
 */
export const getMyDigitalDownloads = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  const {
    page = 1,
    limit = 20,
    search,
    product_type,
  } = req.query;

  const where = {
    student_id: studentId,
  };

  const offset = (parseInt(page) - 1) * parseInt(limit);

  let count = 0;
  let purchases = [];

  try {
    const result = await DigitalDownloadPurchase.findAndCountAll({
      where,
      include: [
        {
          model: DigitalDownloads,
          as: "digitalDownload",
          attributes: [
            "id",
            "title",
            "description",
            "author",
            "pages",
            "product_type",
            "cover_image",
            "preview_url",
            "category",
            "tags",
            "file_url",
            "file_type",
            "file_size",
            "duration",
            "streaming_enabled",
            "download_enabled",
          ],
          required: false,
          ...(product_type ? { where: { product_type } } : {}),
          ...(search ? {
            where: {
              [Op.or]: [
                { title: { [Op.iLike]: `%${search}%` } },
                { author: { [Op.iLike]: `%${search}%` } },
                { description: { [Op.iLike]: `%${search}%` } },
              ],
            },
          } : {}),
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [["created_at", "DESC"]],
    });
    count = result.count;
    purchases = result.rows;
  } catch (error) {
    // Handle case where table doesn't exist yet
    if (error.name === "SequelizeDatabaseError" && 
        (error.message?.includes("does not exist") || 
         error.message?.includes("relation") ||
         error.parent?.code === "42P01")) {
      console.warn("digital_download_purchases table does not exist yet. Run migration first.");
      return res.status(200).json({
        success: true,
        message: "Purchased digital downloads retrieved successfully",
        data: {
          digital_downloads: [],
          pagination: {
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: 0,
          },
        },
      });
    }
    throw error;
  }

  if (!purchases || purchases.length === 0) {
    return res.status(200).json({
      success: true,
      message: "Purchased digital downloads retrieved successfully",
      data: {
        digital_downloads: [],
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  }

  // Generate signed URLs for files (for private buckets)
  let downloadsData = [];
  try {
    downloadsData = await Promise.all(
      purchases.map(async (purchase) => {
        try {
          const purchaseJson = purchase.toJSON();
          const download = purchaseJson.digitalDownload;
          
          // Skip if download was deleted
          if (!download) {
            return null;
          }

          // Generate signed URL for file if needed (for private buckets)
          let fileUrl = download.file_url;
          if (fileUrl && typeof fileUrl === "string") {
            try {
              // Extract file path from URL
              // Handle both formats:
              // - https://{supabase-url}/storage/v1/object/public/{bucket}/{path}
              // - https://{supabase-url}/storage/v1/object/sign/{bucket}/{path}?token=...
              const urlParts = fileUrl.split("/storage/v1/object/");
              if (urlParts.length >= 2) {
                const pathPart = urlParts[1].split("?")[0]; // Remove query params if any
                const pathParts = pathPart.split("/").filter(p => p); // Remove empty strings
                
                // Bucket is the second element (first is "public" or "sign")
                if (pathParts.length >= 2) {
                  const bucket = pathParts[1]; // Second element is the bucket
                  const objectPath = pathParts.slice(2).join("/"); // Path starts from third element

                  if (bucket && objectPath) {
                    // Generate signed URL (1 hour expiration for student access)
                    const { data: signedUrlData, error: urlError } = await supabase.storage
                      .from(bucket)
                      .createSignedUrl(objectPath, 3600);

                    if (!urlError && signedUrlData && signedUrlData.signedUrl) {
                      fileUrl = signedUrlData.signedUrl;
                    }
                  }
                }
              }
            } catch (urlError) {
              console.warn("Failed to generate signed URL for file:", urlError.message || urlError);
            }
          }
          
          return {
            id: download.id,
            title: download.title,
            description: download.description,
            author: download.author,
            pages: download.pages,
            product_type: download.product_type,
            cover_image: download.cover_image,
            preview_url: download.preview_url,
            category: download.category,
            tags: download.tags || [],
            file_url: fileUrl,
            file_type: download.file_type,
            file_size: download.file_size,
            duration: download.duration,
            streaming_enabled: download.streaming_enabled,
            download_enabled: download.download_enabled,
            purchased_at: purchaseJson.created_at,
            purchase_price: parseFloat(purchaseJson.price || 0),
            purchase_currency: purchaseJson.currency,
          };
        } catch (itemError) {
          console.warn("Error processing purchase item:", itemError.message || itemError);
          return null;
        }
      })
    );
  } catch (error) {
    console.error("Error generating signed URLs:", error.message || error);
    // Fallback: return downloads without signed URLs
    downloadsData = purchases
      .map((purchase) => {
        try {
          const purchaseJson = purchase.toJSON();
          const download = purchaseJson.digitalDownload;
          if (!download) return null;
          
          return {
            id: download.id,
            title: download.title,
            description: download.description,
            author: download.author,
            pages: download.pages,
            product_type: download.product_type,
            cover_image: download.cover_image,
            preview_url: download.preview_url,
            category: download.category,
            tags: download.tags || [],
            file_url: download.file_url,
            file_type: download.file_type,
            file_size: download.file_size,
            duration: download.duration,
            streaming_enabled: download.streaming_enabled,
            download_enabled: download.download_enabled,
            purchased_at: purchaseJson.created_at,
            purchase_price: parseFloat(purchaseJson.price || 0),
            purchase_currency: purchaseJson.currency,
          };
        } catch {
          return null;
        }
      })
      .filter(item => item !== null);
  }

  // Filter out null entries
  const validDownloads = downloadsData.filter((item) => item !== null);

  res.status(200).json({
    success: true,
    message: "Purchased digital downloads retrieved successfully",
    data: {
      digital_downloads: validDownloads,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

