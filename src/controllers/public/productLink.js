/**
 * Public Product Link Controller
 * Handles public product pages accessible via /p/:slug
 * Redirects to login/register if user wants to purchase
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
import { Op } from "sequelize";

/**
 * Get product by slug (public endpoint)
 * GET /api/public/product/:slug
 */
export const getProductBySlug = TryCatchFunction(async (req, res) => {
  const { slug } = req.params;

  if (!slug) {
    throw new ErrorClass("Product slug is required", 400);
  }

  // Try to find product in each table
  let product = null;
  let productType = null;
  let tutor = null;

  // Check courses
  product = await Courses.findOne({
    where: {
      slug: slug,
      is_marketplace: true,
      marketplace_status: "published",
      [Op.or]: [
        { deleted_at: null },
        { deleted_at: { [Op.is]: null } },
      ],
    },
    attributes: [
      "id",
      "title",
      "description",
      "price",
      "currency",
      "pricing_type",
      "image_url",
      "category",
      "course_outline",
      "duration_days",
      "enrollment_limit",
      "access_duration_days",
      "owner_type",
      "owner_id",
      "slug",
    ],
  });

  if (product) {
    productType = "course";
  } else {
    // Check ebooks
    product = await EBooks.findOne({
      where: {
        slug: slug,
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
        "tags",
        "owner_type",
        "owner_id",
        "slug",
      ],
    });

    if (product) {
      productType = "ebook";
    } else {
      // Check digital downloads
      product = await DigitalDownloads.findOne({
        where: {
          slug: slug,
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
          "tags",
          "product_type",
          "duration",
          "dimensions",
          "resolution",
          "streaming_enabled",
          "download_enabled",
          "owner_type",
          "owner_id",
          "slug",
        ],
      });

      if (product) {
        productType = "digital_download";
      } else {
        // Check communities
        product = await Community.findOne({
          where: {
            slug: slug,
            status: "published",
            visibility: "public",
          },
          attributes: [
            "id",
            "name",
            "description",
            "category",
            "image_url",
            "icon_url",
            "price",
            "currency",
            "pricing_type",
            "trial_days",
            "member_limit",
            "member_count",
            "tutor_id",
            "tutor_type",
            "slug",
          ],
        });

        if (product) {
          productType = "community";
        } else {
          // Check memberships
          product = await Membership.findOne({
            where: {
              slug: slug,
              status: "active",
            },
            attributes: [
              "id",
              "name",
              "description",
              "category",
              "image_url",
              "pricing_type",
              "price",
              "currency",
              "tutor_id",
              "tutor_type",
              "slug",
            ],
          });

          if (product) {
            productType = "membership";
          }
        }
      }
    }
  }

  if (!product) {
    throw new ErrorClass("Product not found", 404);
  }

  // Get tutor information
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

  // Format product data
  const productData = {
    id: product.id,
    type: productType,
    title: product.title || product.name,
    description: product.description,
    price: parseFloat(product.price || 0),
    currency: product.currency || "NGN",
    slug: product.slug,
    image: product.image_url || product.cover_image || product.icon_url,
    category: product.category,
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
  };

  // Add type-specific fields
  if (productType === "course") {
    productData.pricing_type = product.pricing_type;
    productData.duration_days = product.duration_days;
    productData.enrollment_limit = product.enrollment_limit;
    productData.access_duration_days = product.access_duration_days;
    productData.course_outline = product.course_outline;
  } else if (productType === "ebook") {
    productData.author = product.author;
    productData.pages = product.pages;
    productData.tags = product.tags || [];
  } else if (productType === "digital_download") {
    productData.author = product.author;
    productData.pages = product.pages;
    productData.product_type = product.product_type;
    productData.preview_url = product.preview_url;
    productData.duration = product.duration;
    productData.dimensions = product.dimensions;
    productData.resolution = product.resolution;
    productData.streaming_enabled = product.streaming_enabled;
    productData.download_enabled = product.download_enabled;
    productData.tags = product.tags || [];
  } else if (productType === "community") {
    productData.pricing_type = product.pricing_type;
    productData.trial_days = product.trial_days;
    productData.member_limit = product.member_limit;
    productData.member_count = product.member_count;
    productData.icon_url = product.icon_url;
  } else if (productType === "membership") {
    productData.pricing_type = product.pricing_type;
  }

  res.status(200).json({
    success: true,
    message: "Product retrieved successfully",
    data: {
      product: productData,
      purchase_url: `/purchase/${productType}/${product.id}`,
      login_url: "/login",
      register_url: "/register",
    },
  });
});
