/**
 * Public Sales Page Controller
 * Handles public access to sales pages (no authentication required)
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { ProductSalesPage } from "../../models/marketplace/productSalesPage.js";
import { SalesPageView } from "../../models/marketplace/salesPageView.js";
import { Courses } from "../../models/course/courses.js";
import { EBooks } from "../../models/marketplace/ebooks.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { Community } from "../../models/marketplace/community.js";
import { Membership } from "../../models/marketplace/membership.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { getProductReviewStats } from "../../services/productReviewService.js";
import { Op, QueryTypes } from "sequelize";
import { db } from "../../database/database.js";

/**
 * Get product details for sales page
 */
async function getProductForSalesPage(productType, productId) {
  switch (productType) {
    case "course":
      return await Courses.findOne({
        where: {
          id: productId,
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
          "owner_type",
          "owner_id",
        ],
      });

    case "ebook":
      return await EBooks.findOne({
        where: {
          id: productId,
          status: "published",
        },
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
          "owner_type",
          "owner_id",
        ],
      });

    case "digital_download":
      return await DigitalDownloads.findOne({
        where: {
          id: productId,
          status: "published",
        },
        attributes: [
          "id",
          "title",
          "description",
          "price",
          "currency",
          "cover_image",
          "category",
          "slug",
          "owner_type",
          "owner_id",
        ],
      });

    case "community":
      return await Community.findOne({
        where: {
          id: productId,
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
          "tutor_id",
          "tutor_type",
        ],
      });

    case "membership":
      return await Membership.findOne({
        where: {
          id: productId,
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
          "tutor_id",
          "tutor_type",
        ],
      });

    default:
      return null;
  }
}

/**
 * Track sales page view
 */
async function trackView(salesPageId, req) {
  try {
    const userId = req.user?.id || null;
    const userType = req.user?.userType || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"] || null;
    const referrer = req.headers["referer"] || req.headers["referrer"] || null;

    await SalesPageView.create({
      sales_page_id: salesPageId,
      user_id: userId,
      user_type: userType,
      ip_address: ipAddress,
      user_agent: userAgent,
      referrer: referrer,
      converted: false,
    });

    // Update views count
    await ProductSalesPage.increment("views_count", {
      where: { id: salesPageId },
    });
  } catch (error) {
    // Don't fail the request if tracking fails
    console.error("Error tracking sales page view:", error);
  }
}

/**
 * Get public sales page by slug
 * GET /api/marketplace/public/sales/:slug
 */
export const getSalesPageBySlug = TryCatchFunction(async (req, res) => {
  const { slug } = req.params;

  if (!slug) {
    throw new ErrorClass("Sales page slug is required", 400);
  }

  const salesPage = await ProductSalesPage.findOne({
    where: {
      slug: slug,
      status: "published",
    },
  });

  if (!salesPage) {
    throw new ErrorClass("Sales page not found", 404);
  }

  // Get product details
  const product = await getProductForSalesPage(salesPage.product_type, salesPage.product_id);
  if (!product) {
    throw new ErrorClass("Product not found or not available", 404);
  }

  // Get tutor info
  const ownerId = product.owner_id || product.tutor_id;
  const ownerType = product.owner_type || product.tutor_type;

  let tutor = null;
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
  const reviewStats = await getProductReviewStats(salesPage.product_type, salesPage.product_id);

  // Track view (async, don't wait)
  trackView(salesPage.id, req).catch((error) => {
    console.error("Error tracking view:", error);
  });

  // Build CTA URL
  const ctaUrl = salesPage.call_to_action_url || `/api/marketplace/store/products/${salesPage.product_type}/${salesPage.product_id}`;

  res.status(200).json({
    success: true,
    message: "Sales page retrieved successfully",
    data: {
      sales_page: {
        id: salesPage.id,
        slug: salesPage.slug,
        title: salesPage.title,
        hero_image_url: salesPage.hero_image_url,
        hero_video_url: salesPage.hero_video_url,
        content: salesPage.content,
        features: salesPage.features || [],
        testimonials: salesPage.testimonials || [],
        faq: salesPage.faq || [],
        call_to_action_text: salesPage.call_to_action_text,
        call_to_action_url: ctaUrl,
        meta_title: salesPage.meta_title || salesPage.title,
        meta_description: salesPage.meta_description || product.description,
      },
      product: {
        id: product.id,
        type: salesPage.product_type,
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
      },
      purchase_url: `/api/marketplace/store/products/${salesPage.product_type}/${salesPage.product_id}`,
      add_to_cart_url: `/api/marketplace/store/cart/add`,
      login_url: "/api/auth/login",
      register_url: "/api/auth/register/student",
    },
  });
});

/**
 * Get sales page analytics
 * GET /api/marketplace/tutor/sales-pages/:id/analytics
 */
export const getSalesPageAnalytics = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;
  const tutorType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const { id } = req.params;
  const salesPageId = parseInt(id);

  if (!salesPageId || isNaN(salesPageId)) {
    throw new ErrorClass("Invalid sales page ID", 400);
  }

  const salesPage = await ProductSalesPage.findByPk(salesPageId);

  if (!salesPage) {
    throw new ErrorClass("Sales page not found", 404);
  }

  // Verify product ownership
  const { verifyProductOwnership } = await import("../marketplace/salesPageManagement.js");
  const ownsProduct = await verifyProductOwnership(
    salesPage.product_type,
    salesPage.product_id,
    tutorId,
    tutorType
  );
  if (!ownsProduct) {
    throw new ErrorClass("You don't have permission to view analytics for this sales page", 403);
  }

  // Get view statistics
  const totalViews = await SalesPageView.count({
    where: { sales_page_id: salesPageId },
  });

  // Get unique views (distinct IP addresses)
  const uniqueViewsResult = await db.query(
    `SELECT COUNT(DISTINCT ip_address) as count FROM sales_page_views WHERE sales_page_id = :salesPageId`,
    {
      replacements: { salesPageId },
      type: QueryTypes.SELECT,
    }
  );
  const uniqueViews = uniqueViewsResult[0]?.count || 0;

  const conversions = await SalesPageView.count({
    where: {
      sales_page_id: salesPageId,
      converted: true,
    },
  });

  const conversionRate = totalViews > 0 ? ((conversions / totalViews) * 100).toFixed(2) : 0;

  // Get views by date (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const viewsByDateResult = await db.query(
    `SELECT DATE(viewed_at) as date, COUNT(*) as count 
     FROM sales_page_views 
     WHERE sales_page_id = :salesPageId AND viewed_at >= :thirtyDaysAgo
     GROUP BY DATE(viewed_at)
     ORDER BY DATE(viewed_at) ASC`,
    {
      replacements: { salesPageId, thirtyDaysAgo },
      type: QueryTypes.SELECT,
    }
  );

  res.status(200).json({
    success: true,
    message: "Analytics retrieved successfully",
    data: {
      sales_page: {
        id: salesPage.id,
        title: salesPage.title,
        views_count: salesPage.views_count,
        conversions_count: salesPage.conversions_count,
      },
      analytics: {
        total_views: totalViews,
        unique_views: parseInt(uniqueViews),
        conversions: conversions,
        conversion_rate: parseFloat(conversionRate),
        views_by_date: viewsByDateResult.map((v) => ({
          date: v.date,
          count: parseInt(v.count || 0),
        })),
      },
    },
  });
});
