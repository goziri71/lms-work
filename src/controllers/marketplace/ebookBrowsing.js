import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { EBooks, EBookPurchase } from "../../models/marketplace/index.js";
import { SoleTutor, Organization } from "../../models/marketplace/index.js";
import { Op } from "sequelize";
import { supabase } from "../../utils/supabase.js";
import { db } from "../../database/database.js";

/**
 * Browse all published e-books
 * GET /api/marketplace/ebooks
 */
export const browseEBooks = TryCatchFunction(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    category,
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

  const { count, rows: ebooks } = await EBooks.findAndCountAll({
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
        on: db.Sequelize.literal(`"EBooks"."owner_id" = "soleTutor"."id" AND "EBooks"."owner_type" = 'sole_tutor'`),
      },
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "email"],
        required: false,
        on: db.Sequelize.literal(`"EBooks"."owner_id" = "organization"."id" AND "EBooks"."owner_type" = 'organization'`),
      },
    ],
  });

  // Format response
  const ebooksData = ebooks.map((ebook) => {
    const ebookJson = ebook.toJSON();
    const owner = ebookJson.soleTutor || ebookJson.organization;
    
    return {
      id: ebookJson.id,
      title: ebookJson.title,
      description: ebookJson.description,
      author: ebookJson.author,
      pages: ebookJson.pages,
      price: parseFloat(ebookJson.price || 0),
      currency: ebookJson.currency,
      cover_image: ebookJson.cover_image,
      category: ebookJson.category,
      tags: ebookJson.tags || [],
      sales_count: ebookJson.sales_count,
      owner: owner
        ? {
            id: owner.id,
            name: owner.name || `${owner.fname || ""} ${owner.lname || ""}`.trim(),
            type: ebookJson.owner_type,
          }
        : null,
      created_at: ebookJson.created_at,
    };
  });

  res.status(200).json({
    success: true,
    message: "E-books retrieved successfully",
    data: {
      ebooks: ebooksData,
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
 * Get single e-book details
 * GET /api/marketplace/ebooks/:id
 */
export const getEBookById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const studentId = req.user?.id;

  const ebook = await EBooks.findOne({
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
        on: db.Sequelize.literal(`"EBooks"."owner_id" = "soleTutor"."id" AND "EBooks"."owner_type" = 'sole_tutor'`),
      },
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "email", "description"],
        required: false,
        on: db.Sequelize.literal(`"EBooks"."owner_id" = "organization"."id" AND "EBooks"."owner_type" = 'organization'`),
      },
    ],
  });

  if (!ebook) {
    throw new ErrorClass("E-book not found or not available", 404);
  }

  // Check if student has purchased this e-book
  let is_purchased = false;
  if (studentId && req.user?.userType === "student") {
    const purchase = await EBookPurchase.findOne({
      where: {
        ebook_id: id,
        student_id: studentId,
      },
    });
    is_purchased = !!purchase;
  }

  const ebookJson = ebook.toJSON();
  const owner = ebookJson.soleTutor || ebookJson.organization;

  res.status(200).json({
    success: true,
    message: "E-book retrieved successfully",
    data: {
      ebook: {
        id: ebookJson.id,
        title: ebookJson.title,
        description: ebookJson.description,
        author: ebookJson.author,
        pages: ebookJson.pages,
        price: parseFloat(ebookJson.price || 0),
        currency: ebookJson.currency,
        cover_image: ebookJson.cover_image,
        category: ebookJson.category,
        tags: ebookJson.tags || [],
        sales_count: ebookJson.sales_count,
        owner: owner
          ? {
              id: owner.id,
              name: owner.name || `${owner.fname || ""} ${owner.lname || ""}`.trim(),
              type: ebookJson.owner_type,
              bio: owner.bio || owner.description || null,
            }
          : null,
        is_purchased,
        created_at: ebookJson.created_at,
      },
    },
  });
});

/**
 * Get student's purchased e-books
 * GET /api/marketplace/ebooks/my-ebooks
 */
export const getMyEBooks = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  const {
    page = 1,
    limit = 20,
    search,
  } = req.query;

  const where = {
    student_id: studentId,
  };

  const offset = (parseInt(page) - 1) * parseInt(limit);

  let count = 0;
  let purchases = [];

  try {
    const result = await EBookPurchase.findAndCountAll({
    where,
    include: [
      {
        model: EBooks,
        as: "ebook",
        attributes: [
          "id",
          "title",
          "description",
          "author",
          "pages",
          "cover_image",
          "category",
          "tags",
          "pdf_url",
        ],
        required: false, // Changed to false to handle deleted e-books gracefully
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
      // Table doesn't exist - return empty result
      console.warn("ebook_purchases table does not exist yet. Run migration: node scripts/migrate-create-ebooks-tables.js");
      return res.status(200).json({
        success: true,
        message: "Purchased e-books retrieved successfully",
        data: {
          ebooks: [],
          pagination: {
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: 0,
          },
        },
      });
    }
    // Re-throw other errors
    throw error;
  }

  // Generate signed URLs for PDFs (for private buckets)
  // Handle empty purchases array
  if (!purchases || purchases.length === 0) {
    return res.status(200).json({
      success: true,
      message: "Purchased e-books retrieved successfully",
      data: {
        ebooks: [],
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  }

  let ebooksData = [];
  try {
    ebooksData = await Promise.all(
      purchases.map(async (purchase) => {
        try {
          const purchaseJson = purchase.toJSON();
          const ebook = purchaseJson.ebook;
          
          // Skip if ebook was deleted
          if (!ebook) {
            return null;
          }

          // Generate signed URL for PDF if needed (for private buckets)
          let pdfUrl = ebook.pdf_url;
          if (pdfUrl && typeof pdfUrl === "string") {
            try {
              // Extract file path from URL
              // Handle both formats:
              // - https://{supabase-url}/storage/v1/object/public/{bucket}/{path}
              // - https://{supabase-url}/storage/v1/object/sign/{bucket}/{path}?token=...
              const urlParts = pdfUrl.split("/storage/v1/object/");
              if (urlParts.length >= 2) {
                const pathPart = urlParts[1].split("?")[0]; // Remove query params if any
                const pathParts = pathPart.split("/").filter(p => p); // Remove empty strings
                
                // Skip if path is too short (invalid format)
                if (pathParts.length >= 2) {
                  const bucket = pathParts[0];
                  const objectPath = pathParts.slice(1).join("/");

                  // Only generate signed URL if we have valid bucket and path
                  if (bucket && objectPath) {
                    // Try to generate signed URL (works for both public and private buckets)
                    const { data: signedUrlData, error: urlError } = await supabase.storage
                      .from(bucket)
                      .createSignedUrl(objectPath, 3600); // 1 hour expiration for student access

                    if (!urlError && signedUrlData && signedUrlData.signedUrl) {
                      pdfUrl = signedUrlData.signedUrl;
                    }
                  }
                }
              }
            } catch (urlError) {
              // If signed URL generation fails, use original URL
              console.warn("Failed to generate signed URL for PDF:", urlError.message || urlError);
            }
          }
          
          return {
            id: ebook.id,
            title: ebook.title,
            description: ebook.description,
            author: ebook.author,
            pages: ebook.pages,
            cover_image: ebook.cover_image,
            category: ebook.category,
            tags: ebook.tags || [],
            pdf_url: pdfUrl,
            purchased_at: purchaseJson.created_at,
            purchase_price: parseFloat(purchaseJson.price || 0),
            purchase_currency: purchaseJson.currency,
          };
        } catch (itemError) {
          // Log error but don't fail entire request
          console.warn("Error processing purchase item:", itemError.message || itemError);
          return null;
        }
      })
    );
  } catch (error) {
    // If Promise.all fails, log and return empty array
    console.error("Error generating signed URLs:", error.message || error);
    // Fallback: return ebooks without signed URLs
    ebooksData = purchases
      .map((purchase) => {
        try {
          const purchaseJson = purchase.toJSON();
          const ebook = purchaseJson.ebook;
          if (!ebook) return null;
          
          return {
            id: ebook.id,
            title: ebook.title,
            description: ebook.description,
            author: ebook.author,
            pages: ebook.pages,
            cover_image: ebook.cover_image,
            category: ebook.category,
            tags: ebook.tags || [],
            pdf_url: ebook.pdf_url, // Use original URL as fallback
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
  const validEbooks = ebooksData.filter((item) => item !== null);

  res.status(200).json({
    success: true,
    message: "Purchased e-books retrieved successfully",
    data: {
      ebooks: validEbooks,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

