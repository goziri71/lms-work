/**
 * Public Store Browsing Controller
 * Allows browsing products without authentication (like e-commerce)
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Courses } from "../../models/course/courses.js";
import { EBooks } from "../../models/marketplace/ebooks.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { Community } from "../../models/marketplace/community.js";
import { Membership } from "../../models/marketplace/membership.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { getProductReviewStats } from "../../services/productReviewService.js";
import { Op } from "sequelize";

/**
 * Browse all products (public - no auth required)
 * GET /api/marketplace/store/products
 */
export const browseStoreProducts = TryCatchFunction(async (req, res) => {
  const {
    product_type,
    category,
    search,
    min_price,
    max_price,
    page = 1,
    limit = 20,
    sort = "newest",
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const allProducts = [];

  // Determine which product types to fetch
  const productTypes = product_type
    ? [product_type]
    : ["course", "ebook", "digital_download", "community", "membership"];

  // Fetch products from each type
  for (const type of productTypes) {
    let products = [];
    let count = 0;

    const where = {};
    const priceWhere = {};

    // Common filters
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (min_price) {
      priceWhere[Op.gte] = parseFloat(min_price);
    }
    if (max_price) {
      priceWhere[Op.lte] = parseFloat(max_price);
    }
    if (Object.keys(priceWhere).length > 0) {
      where.price = priceWhere;
    }

    // Type-specific filters
    switch (type) {
      case "course":
        where.is_marketplace = true;
        where.marketplace_status = "published";
        where[Op.or] = [
          { deleted_at: null },
          { deleted_at: { [Op.is]: null } },
        ];
        ({ count, rows: products } = await Courses.findAndCountAll({
          where,
          limit: parseInt(limit),
          offset,
          order: getSortOrder(sort, "courses"),
          attributes: [
            "id",
            "title",
            "description",
            "price",
            "currency",
            "image_url",
            "category",
            "slug",
            "duration_days",
            "owner_type",
            "owner_id",
          ],
        }));
        break;

      case "ebook":
        where.status = "published";
        ({ count, rows: products } = await EBooks.findAndCountAll({
          where,
          limit: parseInt(limit),
          offset,
          order: getSortOrder(sort, "ebooks"),
          attributes: [
            "id",
            "title",
            "description",
            "author",
            "price",
            "currency",
            "cover_image",
            "category",
            "slug",
            "pages",
            "owner_type",
            "owner_id",
          ],
        }));
        break;

      case "digital_download":
        where.status = "published";
        ({ count, rows: products } = await DigitalDownloads.findAndCountAll({
          where,
          limit: parseInt(limit),
          offset,
          order: getSortOrder(sort, "digital_downloads"),
          attributes: [
            "id",
            "title",
            "description",
            "author",
            "price",
            "currency",
            "cover_image",
            "category",
            "slug",
            "product_type",
            "owner_type",
            "owner_id",
          ],
        }));
        break;

      case "community":
        where.status = "published";
        where.visibility = "public";
        ({ count, rows: products } = await Community.findAndCountAll({
          where,
          limit: parseInt(limit),
          offset,
          order: getSortOrder(sort, "communities"),
          attributes: [
            "id",
            "name",
            "description",
            "price",
            "currency",
            "image_url",
            "category",
            "slug",
            "member_count",
            "tutor_id",
            "tutor_type",
          ],
        }));
        break;

      case "membership":
        where.status = "active";
        ({ count, rows: products } = await Membership.findAndCountAll({
          where,
          limit: parseInt(limit),
          offset,
          order: getSortOrder(sort, "memberships"),
          attributes: [
            "id",
            "name",
            "description",
            "price",
            "currency",
            "image_url",
            "category",
            "slug",
            "pricing_type",
            "tutor_id",
            "tutor_type",
          ],
        }));
        break;
    }

    // Format products and get tutor info
    for (const product of products) {
      const ownerId = product.owner_id || product.tutor_id;
      const ownerType = product.owner_type || product.tutor_type;

      let tutor = null;
      if (ownerId && ownerType) {
        if (ownerType === "sole_tutor") {
          tutor = await SoleTutor.findByPk(ownerId, {
            attributes: ["id", "fname", "lname", "profile_image"],
          });
        } else if (ownerType === "organization") {
          tutor = await Organization.findByPk(ownerId, {
            attributes: ["id", "name", "logo"],
          });
        }
      }

      // Get review stats
      const reviewStats = await getProductReviewStats(type, product.id);

      const productData = {
        id: product.id,
        type: type,
        title: product.title || product.name,
        description: product.description,
        price: parseFloat(product.price || 0),
        currency: product.currency || "NGN",
        image_url: product.image_url || product.cover_image,
        category: product.category,
        slug: product.slug,
        tutor: tutor
          ? {
              id: tutor.id,
              name:
                ownerType === "sole_tutor"
                  ? `${tutor.fname} ${tutor.lname || ""}`.trim()
                  : tutor.name,
              image: tutor.profile_image || tutor.logo,
            }
          : null,
        reviews: reviewStats,
      };

      // Add type-specific fields
      if (type === "course") {
        productData.duration_days = product.duration_days;
      } else if (type === "ebook" || type === "digital_download") {
        productData.author = product.author;
        productData.pages = product.pages;
        if (type === "digital_download") {
          productData.product_type = product.product_type;
        }
      } else if (type === "community") {
        productData.member_count = product.member_count;
      } else if (type === "membership") {
        productData.pricing_type = product.pricing_type;
      }

      allProducts.push(productData);
    }
  }

  // Sort all products if needed (when fetching multiple types)
  if (productTypes.length > 1) {
    allProducts.sort((a, b) => {
      switch (sort) {
        case "price_low":
          return a.price - b.price;
        case "price_high":
          return b.price - a.price;
        case "newest":
        default:
          return b.id - a.id;
      }
    });
  }

  res.status(200).json({
    success: true,
    message: "Products retrieved successfully",
    data: {
      products: allProducts,
      pagination: {
        total: allProducts.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(allProducts.length / parseInt(limit)),
      },
    },
  });
});

/**
 * Helper function to get sort order
 */
function getSortOrder(sort, tableName) {
  const titleField = tableName === "communities" || tableName === "memberships" ? "name" : "title";

  switch (sort) {
    case "oldest":
      return [["id", "ASC"]];
    case "price_low":
      return [["price", "ASC"]];
    case "price_high":
      return [["price", "DESC"]];
    case "popular":
      if (tableName === "digital_downloads" || tableName === "ebooks") {
        return [["sales_count", "DESC"]];
      }
      return [["id", "DESC"]];
    case "newest":
    default:
      return [["id", "DESC"]];
  }
}

/**
 * Get product details for store (public)
 * GET /api/marketplace/store/products/:type/:id
 */
export const getStoreProduct = TryCatchFunction(async (req, res) => {
  const { type, id } = req.params;

  if (!["course", "ebook", "digital_download", "community", "membership"].includes(type)) {
    throw new ErrorClass("Invalid product type", 400);
  }

  let product = null;
  let tutor = null;

  switch (type) {
    case "course":
      product = await Courses.findOne({
        where: {
          id: parseInt(id),
          is_marketplace: true,
          marketplace_status: "published",
        },
        attributes: [
          "id",
          "title",
          "description",
          "price",
          "currency",
          "image_url",
          "category",
          "slug",
          "duration_days",
          "enrollment_limit",
          "access_duration_days",
          "course_outline",
          "owner_type",
          "owner_id",
        ],
      });
      break;

    case "ebook":
      product = await EBooks.findOne({
        where: {
          id: parseInt(id),
          status: "published",
        },
        attributes: [
          "id",
          "title",
          "description",
          "author",
          "pages",
          "price",
          "currency",
          "cover_image",
          "category",
          "slug",
          "tags",
          "owner_type",
          "owner_id",
        ],
      });
      break;

    case "digital_download":
      product = await DigitalDownloads.findOne({
        where: {
          id: parseInt(id),
          status: "published",
        },
        attributes: [
          "id",
          "title",
          "description",
          "author",
          "pages",
          "price",
          "currency",
          "cover_image",
          "preview_url",
          "category",
          "slug",
          "tags",
          "product_type",
          "duration",
          "dimensions",
          "resolution",
          "owner_type",
          "owner_id",
        ],
      });
      break;

    case "community":
      product = await Community.findOne({
        where: {
          id: parseInt(id),
          status: "published",
          visibility: "public",
        },
        attributes: [
          "id",
          "name",
          "description",
          "price",
          "currency",
          "image_url",
          "category",
          "slug",
          "member_count",
          "trial_days",
          "tutor_id",
          "tutor_type",
        ],
      });
      break;

    case "membership":
      product = await Membership.findOne({
        where: {
          id: parseInt(id),
          status: "active",
        },
        attributes: [
          "id",
          "name",
          "description",
          "price",
          "currency",
          "image_url",
          "category",
          "slug",
          "pricing_type",
          "tutor_id",
          "tutor_type",
        ],
      });
      break;
  }

  if (!product) {
    throw new ErrorClass("Product not found or not available", 404);
  }

  // Get tutor info
  const ownerId = product.owner_id || product.tutor_id;
  const ownerType = product.owner_type || product.tutor_type;

  if (ownerId && ownerType) {
    if (ownerType === "sole_tutor") {
      tutor = await SoleTutor.findByPk(ownerId, {
        attributes: ["id", "fname", "lname", "mname", "profile_image", "bio", "specialization"],
      });
    } else if (ownerType === "organization") {
      tutor = await Organization.findByPk(ownerId, {
        attributes: ["id", "name", "logo", "description"],
      });
    }
  }

  // Get review stats
  const reviewStats = await getProductReviewStats(type, product.id);

  // Format product data
  const productData = {
    id: product.id,
    type: type,
    title: product.title || product.name,
    description: product.description,
    price: parseFloat(product.price || 0),
    currency: product.currency || "NGN",
    image_url: product.image_url || product.cover_image,
    category: product.category,
    slug: product.slug,
    tutor: tutor
      ? {
          id: tutor.id,
          name:
            ownerType === "sole_tutor"
              ? `${tutor.fname} ${tutor.lname || ""}`.trim()
              : tutor.name,
          image: tutor.profile_image || tutor.logo,
          bio: tutor.bio || tutor.description,
        }
      : null,
    reviews: reviewStats,
  };

  // Add type-specific fields
  if (type === "course") {
    productData.duration_days = product.duration_days;
    productData.enrollment_limit = product.enrollment_limit;
    productData.access_duration_days = product.access_duration_days;
    productData.course_outline = product.course_outline;
  } else if (type === "ebook") {
    productData.author = product.author;
    productData.pages = product.pages;
    productData.tags = product.tags || [];
  } else if (type === "digital_download") {
    productData.author = product.author;
    productData.pages = product.pages;
    productData.product_type = product.product_type;
    productData.preview_url = product.preview_url;
    productData.duration = product.duration;
    productData.dimensions = product.dimensions;
    productData.resolution = product.resolution;
    productData.tags = product.tags || [];
  } else if (type === "community") {
    productData.member_count = product.member_count;
    productData.trial_days = product.trial_days;
  } else if (type === "membership") {
    productData.pricing_type = product.pricing_type;
  }

  res.status(200).json({
    success: true,
    message: "Product retrieved successfully",
    data: {
      product: productData,
      add_to_cart_url: `/api/marketplace/store/cart/add`,
      checkout_url: `/api/marketplace/store/checkout`,
      login_url: `/api/auth/login`,
      register_url: `/api/auth/register/student`,
    },
  });
});
