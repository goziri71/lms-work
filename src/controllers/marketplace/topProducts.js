/**
 * Top Products Controller
 * Handles endpoints for featured, trending, and top products
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
 * Helper function to format product data
 */
async function formatProductData(product, productType) {
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
  const reviewStats = await getProductReviewStats(productType, product.id);

  const productData = {
    id: product.id,
    type: productType,
    title: product.title || product.name,
    description: product.description,
    price: parseFloat(product.price || 0),
    currency: product.currency || "NGN",
    image_url: product.image_url || product.cover_image,
    category: product.category,
    slug: product.slug,
    popularity_score: parseFloat(product.popularity_score || 0),
    sales_count: product.sales_count || 0,
    is_featured: product.is_featured || false,
    featured_at: product.featured_at,
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
  if (productType === "course") {
    productData.duration_days = product.duration_days;
  } else if (productType === "ebook" || productType === "digital_download") {
    productData.author = product.author;
    productData.pages = product.pages;
  } else if (productType === "community") {
    productData.member_count = product.member_count;
  } else if (productType === "membership") {
    productData.pricing_type = product.pricing_type;
  }

  return productData;
}

/**
 * Get featured products
 * GET /api/marketplace/products/featured
 */
export const getFeaturedProducts = TryCatchFunction(async (req, res) => {
  const { product_type, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const productTypes = product_type
    ? [product_type]
    : ["course", "ebook", "digital_download", "community", "membership"];

  const allProducts = [];

  for (const type of productTypes) {
    let products = [];

    switch (type) {
      case "course":
        products = await Courses.findAll({
          where: {
            is_marketplace: true,
            marketplace_status: "published",
            is_featured: true,
            [Op.or]: [
              { deleted_at: null },
              { deleted_at: { [Op.is]: null } },
            ],
          },
          limit: parseInt(limit),
          offset,
          order: [["featured_at", "DESC"], ["popularity_score", "DESC"]],
          attributes: [
            "id",
            "title",
            "description",
            "price",
            "currency",
            "image_url",
            "category",
            "slug",
            "popularity_score",
            "sales_count",
            "is_featured",
            "featured_at",
            "duration_days",
            "owner_type",
            "owner_id",
          ],
        });
        break;

      case "ebook":
        products = await EBooks.findAll({
          where: {
            status: "published",
            is_featured: true,
          },
          limit: parseInt(limit),
          offset,
          order: [["featured_at", "DESC"], ["popularity_score", "DESC"]],
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
            "popularity_score",
            "sales_count",
            "is_featured",
            "featured_at",
            "pages",
            "owner_type",
            "owner_id",
          ],
        });
        break;

      case "digital_download":
        products = await DigitalDownloads.findAll({
          where: {
            status: "published",
            is_featured: true,
          },
          limit: parseInt(limit),
          offset,
          order: [["featured_at", "DESC"], ["popularity_score", "DESC"]],
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
            "popularity_score",
            "sales_count",
            "is_featured",
            "featured_at",
            "pages",
            "owner_type",
            "owner_id",
          ],
        });
        break;

      case "community":
        products = await Community.findAll({
          where: {
            status: "published",
            visibility: "public",
            is_featured: true,
          },
          limit: parseInt(limit),
          offset,
          order: [["featured_at", "DESC"], ["popularity_score", "DESC"]],
          attributes: [
            "id",
            "name",
            "description",
            "price",
            "currency",
            "image_url",
            "category",
            "slug",
            "popularity_score",
            "sales_count",
            "is_featured",
            "featured_at",
            "member_count",
            "tutor_id",
            "tutor_type",
          ],
        });
        break;

      case "membership":
        products = await Membership.findAll({
          where: {
            status: "active",
            is_featured: true,
          },
          limit: parseInt(limit),
          offset,
          order: [["featured_at", "DESC"], ["popularity_score", "DESC"]],
          attributes: [
            "id",
            "name",
            "description",
            "price",
            "currency",
            "image_url",
            "category",
            "slug",
            "popularity_score",
            "sales_count",
            "is_featured",
            "featured_at",
            "pricing_type",
            "tutor_id",
            "tutor_type",
          ],
        });
        break;
    }

    // Format products
    for (const product of products) {
      const formatted = await formatProductData(product, type);
      allProducts.push(formatted);
    }
  }

  // Sort by featured_at (most recently featured first)
  allProducts.sort((a, b) => {
    if (a.featured_at && b.featured_at) {
      return new Date(b.featured_at) - new Date(a.featured_at);
    }
    if (a.featured_at) return -1;
    if (b.featured_at) return 1;
    return b.popularity_score - a.popularity_score;
  });

  res.status(200).json({
    success: true,
    message: "Featured products retrieved successfully",
    data: {
      products: allProducts.slice(0, parseInt(limit)),
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
 * Get trending products (highest popularity score)
 * GET /api/marketplace/products/trending
 */
export const getTrendingProducts = TryCatchFunction(async (req, res) => {
  const { product_type, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const productTypes = product_type
    ? [product_type]
    : ["course", "ebook", "digital_download", "community", "membership"];

  const allProducts = [];

  for (const type of productTypes) {
    let products = [];

    switch (type) {
      case "course":
        products = await Courses.findAll({
          where: {
            is_marketplace: true,
            marketplace_status: "published",
            [Op.or]: [
              { deleted_at: null },
              { deleted_at: { [Op.is]: null } },
            ],
          },
          limit: parseInt(limit),
          offset,
          order: [["popularity_score", "DESC"]],
          attributes: [
            "id",
            "title",
            "description",
            "price",
            "currency",
            "image_url",
            "category",
            "slug",
            "popularity_score",
            "sales_count",
            "owner_type",
            "owner_id",
          ],
        });
        break;

      case "ebook":
        products = await EBooks.findAll({
          where: { status: "published" },
          limit: parseInt(limit),
          offset,
          order: [["popularity_score", "DESC"]],
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
            "popularity_score",
            "sales_count",
            "owner_type",
            "owner_id",
          ],
        });
        break;

      case "digital_download":
        products = await DigitalDownloads.findAll({
          where: { status: "published" },
          limit: parseInt(limit),
          offset,
          order: [["popularity_score", "DESC"]],
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
            "popularity_score",
            "sales_count",
            "owner_type",
            "owner_id",
          ],
        });
        break;

      case "community":
        products = await Community.findAll({
          where: {
            status: "published",
            visibility: "public",
          },
          limit: parseInt(limit),
          offset,
          order: [["popularity_score", "DESC"]],
          attributes: [
            "id",
            "name",
            "description",
            "price",
            "currency",
            "image_url",
            "category",
            "slug",
            "popularity_score",
            "sales_count",
            "tutor_id",
            "tutor_type",
          ],
        });
        break;

      case "membership":
        products = await Membership.findAll({
          where: { status: "active" },
          limit: parseInt(limit),
          offset,
          order: [["popularity_score", "DESC"]],
          attributes: [
            "id",
            "name",
            "description",
            "price",
            "currency",
            "image_url",
            "category",
            "slug",
            "popularity_score",
            "sales_count",
            "tutor_id",
            "tutor_type",
          ],
        });
        break;
    }

    // Format products
    for (const product of products) {
      const formatted = await formatProductData(product, type);
      allProducts.push(formatted);
    }
  }

  // Sort by popularity score
  allProducts.sort((a, b) => b.popularity_score - a.popularity_score);

  res.status(200).json({
    success: true,
    message: "Trending products retrieved successfully",
    data: {
      products: allProducts.slice(0, parseInt(limit)),
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
 * Get top products (best sellers - highest sales count)
 * GET /api/marketplace/products/top
 */
export const getTopProducts = TryCatchFunction(async (req, res) => {
  const { product_type, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const productTypes = product_type
    ? [product_type]
    : ["course", "ebook", "digital_download", "community", "membership"];

  const allProducts = [];

  for (const type of productTypes) {
    let products = [];

    switch (type) {
      case "course":
        products = await Courses.findAll({
          where: {
            is_marketplace: true,
            marketplace_status: "published",
            [Op.or]: [
              { deleted_at: null },
              { deleted_at: { [Op.is]: null } },
            ],
          },
          limit: parseInt(limit),
          offset,
          order: [["sales_count", "DESC"]],
          attributes: [
            "id",
            "title",
            "description",
            "price",
            "currency",
            "image_url",
            "category",
            "slug",
            "popularity_score",
            "sales_count",
            "owner_type",
            "owner_id",
          ],
        });
        break;

      case "ebook":
        products = await EBooks.findAll({
          where: { status: "published" },
          limit: parseInt(limit),
          offset,
          order: [["sales_count", "DESC"]],
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
            "popularity_score",
            "sales_count",
            "owner_type",
            "owner_id",
          ],
        });
        break;

      case "digital_download":
        products = await DigitalDownloads.findAll({
          where: { status: "published" },
          limit: parseInt(limit),
          offset,
          order: [["sales_count", "DESC"]],
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
            "popularity_score",
            "sales_count",
            "owner_type",
            "owner_id",
          ],
        });
        break;

      case "community":
        products = await Community.findAll({
          where: {
            status: "published",
            visibility: "public",
          },
          limit: parseInt(limit),
          offset,
          order: [["sales_count", "DESC"]],
          attributes: [
            "id",
            "name",
            "description",
            "price",
            "currency",
            "image_url",
            "category",
            "slug",
            "popularity_score",
            "sales_count",
            "tutor_id",
            "tutor_type",
          ],
        });
        break;

      case "membership":
        products = await Membership.findAll({
          where: { status: "active" },
          limit: parseInt(limit),
          offset,
          order: [["sales_count", "DESC"]],
          attributes: [
            "id",
            "name",
            "description",
            "price",
            "currency",
            "image_url",
            "category",
            "slug",
            "popularity_score",
            "sales_count",
            "tutor_id",
            "tutor_type",
          ],
        });
        break;
    }

    // Format products
    for (const product of products) {
      const formatted = await formatProductData(product, type);
      allProducts.push(formatted);
    }
  }

  // Sort by sales count
  allProducts.sort((a, b) => b.sales_count - a.sales_count);

  res.status(200).json({
    success: true,
    message: "Top products retrieved successfully",
    data: {
      products: allProducts.slice(0, parseInt(limit)),
      pagination: {
        total: allProducts.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(allProducts.length / parseInt(limit)),
      },
    },
  });
});
