/**
 * Product Popularity Service
 * Calculates popularity scores for products based on sales, reviews, and views
 */

import { Courses } from "../models/course/courses.js";
import { EBooks } from "../models/marketplace/ebooks.js";
import { DigitalDownloads } from "../models/marketplace/digitalDownloads.js";
import { Community } from "../models/marketplace/community.js";
import { Membership } from "../models/marketplace/membership.js";
import { ProductReview } from "../models/marketplace/productReview.js";
import { ProductSalesPage } from "../models/marketplace/productSalesPage.js";
import { Op } from "sequelize";

/**
 * Calculate popularity score for a product
 * Formula: (sales_count * 10) + (review_count * 5) + (average_rating * 2) + (views_count * 0.1)
 * 
 * @param {string} productType - Type of product
 * @param {number} productId - Product ID
 * @returns {Promise<number>} Popularity score
 */
export async function calculateProductPopularity(productType, productId) {
  let salesCount = 0;
  let reviewCount = 0;
  let averageRating = 0;
  let viewsCount = 0;

  // Get sales count from product table
  switch (productType) {
    case "course":
      const course = await Courses.findOne({
        where: { id: productId },
        attributes: ["sales_count"],
      });
      salesCount = course?.sales_count || 0;
      break;

    case "ebook":
      const ebook = await EBooks.findOne({
        where: { id: productId },
        attributes: ["sales_count"],
      });
      salesCount = ebook?.sales_count || 0;
      break;

    case "digital_download":
      const download = await DigitalDownloads.findOne({
        where: { id: productId },
        attributes: ["sales_count"],
      });
      salesCount = download?.sales_count || 0;
      break;

    case "community":
      const community = await Community.findOne({
        where: { id: productId },
        attributes: ["sales_count"],
      });
      salesCount = community?.sales_count || 0;
      break;

    case "membership":
      const membership = await Membership.findOne({
        where: { id: productId },
        attributes: ["sales_count"],
      });
      salesCount = membership?.sales_count || 0;
      break;
  }

  // Get review statistics
  const reviews = await ProductReview.findAll({
    where: {
      product_type: productType,
      product_id: productId,
      status: "approved",
    },
    attributes: ["rating"],
  });

  reviewCount = reviews.length;
  if (reviewCount > 0) {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    averageRating = totalRating / reviewCount;
  }

  // Get views count from sales page (if exists)
  const salesPage = await ProductSalesPage.findOne({
    where: {
      product_type: productType,
      product_id: productId,
      status: "published",
    },
    attributes: ["views_count"],
  });
  viewsCount = salesPage?.views_count || 0;

  // Calculate popularity score
  // Weight: sales (10x), reviews (5x), rating (2x), views (0.1x)
  const score =
    salesCount * 10 +
    reviewCount * 5 +
    averageRating * 2 +
    viewsCount * 0.1;

  return parseFloat(score.toFixed(2));
}

/**
 * Update popularity score for a single product
 */
export async function updateProductPopularity(productType, productId) {
  const score = await calculateProductPopularity(productType, productId);

  switch (productType) {
    case "course":
      await Courses.update(
        { popularity_score: score },
        { where: { id: productId } }
      );
      break;

    case "ebook":
      await EBooks.update(
        { popularity_score: score },
        { where: { id: productId } }
      );
      break;

    case "digital_download":
      await DigitalDownloads.update(
        { popularity_score: score },
        { where: { id: productId } }
      );
      break;

    case "community":
      await Community.update(
        { popularity_score: score },
        { where: { id: productId } }
      );
      break;

    case "membership":
      await Membership.update(
        { popularity_score: score },
        { where: { id: productId } }
      );
      break;
  }

  return score;
}

/**
 * Update popularity scores for all products
 * Used by cron job
 */
export async function updateAllProductPopularity() {
  console.log("🔄 Starting popularity score update...");

  const productTypes = ["course", "ebook", "digital_download", "community", "membership"];
  let totalUpdated = 0;

  for (const productType of productTypes) {
    let products = [];

    switch (productType) {
      case "course":
        products = await Courses.findAll({
          where: {
            is_marketplace: true,
            marketplace_status: "published",
          },
          attributes: ["id"],
        });
        break;

      case "ebook":
        products = await EBooks.findAll({
          where: { status: "published" },
          attributes: ["id"],
        });
        break;

      case "digital_download":
        products = await DigitalDownloads.findAll({
          where: { status: "published" },
          attributes: ["id"],
        });
        break;

      case "community":
        products = await Community.findAll({
          where: { status: "published" },
          attributes: ["id"],
        });
        break;

      case "membership":
        products = await Membership.findAll({
          where: { status: "active" },
          attributes: ["id"],
        });
        break;
    }

    console.log(`   📦 Processing ${products.length} ${productType} products...`);

    for (const product of products) {
      try {
        await updateProductPopularity(productType, product.id);
        totalUpdated++;
      } catch (error) {
        console.error(`   ❌ Error updating ${productType} ${product.id}:`, error.message);
      }
    }
  }

  console.log(`✅ Popularity score update completed. Updated ${totalUpdated} products.`);
  return { success: true, totalUpdated };
}
