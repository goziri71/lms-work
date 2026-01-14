/**
 * Product Review Service
 * Provides review aggregation and statistics for products
 */

import { ProductReview } from "../models/marketplace/productReview.js";
import { Students } from "../models/auth/student.js";
import { Op } from "sequelize";
import { db } from "../database/database.js";

/**
 * Get review statistics for a product
 * @param {string} productType - Type of product
 * @param {number} productId - Product ID
 * @returns {Promise<Object>} Review statistics
 */
export async function getProductReviewStats(productType, productId) {
  const where = {
    product_type: productType,
    product_id: productId,
    status: "approved",
  };

  const stats = await ProductReview.findAll({
    where,
    attributes: [
      [db.fn("COUNT", db.col("id")), "total_reviews"],
      [db.fn("AVG", db.col("rating")), "average_rating"],
      [db.fn("COUNT", db.literal("CASE WHEN rating = 5 THEN 1 END")), "five_star"],
      [db.fn("COUNT", db.literal("CASE WHEN rating = 4 THEN 1 END")), "four_star"],
      [db.fn("COUNT", db.literal("CASE WHEN rating = 3 THEN 1 END")), "three_star"],
      [db.fn("COUNT", db.literal("CASE WHEN rating = 2 THEN 1 END")), "two_star"],
      [db.fn("COUNT", db.literal("CASE WHEN rating = 1 THEN 1 END")), "one_star"],
    ],
    raw: true,
  });

  const result = stats[0] || {
    total_reviews: 0,
    average_rating: 0,
    five_star: 0,
    four_star: 0,
    three_star: 0,
    two_star: 0,
    one_star: 0,
  };

  return {
    total_reviews: parseInt(result.total_reviews || 0),
    average_rating: parseFloat(result.average_rating || 0).toFixed(1),
    rating_distribution: {
      five_star: parseInt(result.five_star || 0),
      four_star: parseInt(result.four_star || 0),
      three_star: parseInt(result.three_star || 0),
      two_star: parseInt(result.two_star || 0),
      one_star: parseInt(result.one_star || 0),
    },
  };
}

/**
 * Get top reviews for a product (most helpful)
 * @param {string} productType - Type of product
 * @param {number} productId - Product ID
 * @param {number} limit - Number of reviews to return
 * @returns {Promise<Array>} Array of reviews
 */
export async function getTopReviews(productType, productId, limit = 3) {
  return await ProductReview.findAll({
    where: {
      product_type: productType,
      product_id: productId,
      status: "approved",
    },
    limit,
    order: [["helpful_count", "DESC"], ["created_at", "DESC"]],
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "mname", "profile_image"],
      },
    ],
  });
}
