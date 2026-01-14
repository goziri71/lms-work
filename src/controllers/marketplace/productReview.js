/**
 * Product Review Controller
 * Handles creating, retrieving, and managing product reviews
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { ProductReview } from "../../models/marketplace/productReview.js";
import { ReviewHelpfulVote } from "../../models/marketplace/reviewHelpfulVote.js";
import { Students } from "../../models/auth/student.js";
import { MarketplaceTransaction } from "../../models/marketplace/marketplaceTransaction.js";
import { EBookPurchase } from "../../models/marketplace/ebookPurchase.js";
import { DigitalDownloadPurchase } from "../../models/marketplace/digitalDownloadPurchase.js";
import { CommunityPurchase } from "../../models/marketplace/communityPurchase.js";
import { MembershipSubscription } from "../../models/marketplace/membershipSubscription.js";
import { Op } from "sequelize";
import { db } from "../../database/database.js";

/**
 * Check if student has purchased/accessed the product
 */
async function checkProductPurchase(studentId, productType, productId) {
  switch (productType) {
    case "course":
      const coursePurchase = await MarketplaceTransaction.findOne({
        where: {
          student_id: studentId,
          course_id: productId,
          status: "successful",
        },
      });
      return !!coursePurchase;

    case "ebook":
      const ebookPurchase = await EBookPurchase.findOne({
        where: {
          student_id: studentId,
          ebook_id: productId,
        },
      });
      return !!ebookPurchase;

    case "digital_download":
      const downloadPurchase = await DigitalDownloadPurchase.findOne({
        where: {
          student_id: studentId,
          digital_download_id: productId,
        },
      });
      return !!downloadPurchase;

    case "community":
      const communityPurchase = await CommunityPurchase.findOne({
        where: {
          student_id: studentId,
          community_id: productId,
        },
      });
      return !!communityPurchase;

    case "membership":
      const membershipSubscription = await MembershipSubscription.findOne({
        where: {
          student_id: studentId,
          membership_id: productId,
          status: "active",
        },
      });
      return !!membershipSubscription;

    default:
      return false;
  }
}

/**
 * Create a product review
 * POST /api/marketplace/reviews
 */
export const createReview = TryCatchFunction(async (req, res) => {
  const studentId = req.user.id;
  const { product_type, product_id, rating, title, comment } = req.body;

  // Validation
  if (!product_type || !product_id || !rating) {
    throw new ErrorClass("product_type, product_id, and rating are required", 400);
  }

  if (!["course", "ebook", "digital_download", "community", "membership"].includes(product_type)) {
    throw new ErrorClass("Invalid product_type", 400);
  }

  if (![1, 2, 3, 4, 5].includes(parseInt(rating))) {
    throw new ErrorClass("Rating must be between 1 and 5", 400);
  }

  // Check if student already reviewed this product
  const existingReview = await ProductReview.findOne({
    where: {
      student_id: studentId,
      product_type,
      product_id: parseInt(product_id),
    },
  });

  if (existingReview) {
    throw new ErrorClass("You have already reviewed this product", 400);
  }

  // Check if student has purchased the product (for verified purchase badge)
  const hasPurchased = await checkProductPurchase(studentId, product_type, parseInt(product_id));

  // Create review
  const review = await ProductReview.create({
    student_id: studentId,
    product_type,
    product_id: parseInt(product_id),
    rating: parseInt(rating),
    title: title ? title.trim() : null,
    comment: comment ? comment.trim() : null,
    is_verified_purchase: hasPurchased,
    status: "approved", // Auto-approve for now (can add moderation later)
  });

  // Get student info for response
  const student = await Students.findByPk(studentId, {
    attributes: ["id", "fname", "lname", "mname", "profile_image"],
  });

  res.status(201).json({
    success: true,
    message: "Review created successfully",
    data: {
      review: {
        id: review.id,
        product_type: review.product_type,
        product_id: review.product_id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        helpful_count: review.helpful_count,
        is_verified_purchase: review.is_verified_purchase,
        created_at: review.created_at,
        student: {
          id: student.id,
          name: `${student.fname} ${student.lname || ""}`.trim(),
          profile_image: student.profile_image,
        },
      },
    },
  });
});

/**
 * Get reviews for a product
 * GET /api/marketplace/reviews?product_type=course&product_id=1
 */
export const getProductReviews = TryCatchFunction(async (req, res) => {
  const { product_type, product_id, page = 1, limit = 20, sort = "helpful" } = req.query;
  const studentId = req.user?.id; // Optional - for checking if user voted

  if (!product_type || !product_id) {
    throw new ErrorClass("product_type and product_id are required", 400);
  }

  if (!["course", "ebook", "digital_download", "community", "membership"].includes(product_type)) {
    throw new ErrorClass("Invalid product_type", 400);
  }

  const where = {
    product_type,
    product_id: parseInt(product_id),
    status: "approved", // Only show approved reviews
  };

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Determine sort order
  let order;
  switch (sort) {
    case "newest":
      order = [["created_at", "DESC"]];
      break;
    case "oldest":
      order = [["created_at", "ASC"]];
      break;
    case "highest_rating":
      order = [["rating", "DESC"], ["created_at", "DESC"]];
      break;
    case "lowest_rating":
      order = [["rating", "ASC"], ["created_at", "DESC"]];
      break;
    case "helpful":
    default:
      order = [["helpful_count", "DESC"], ["created_at", "DESC"]];
      break;
  }

  // Get reviews with pagination
  const { count, rows: reviews } = await ProductReview.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order,
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "mname", "profile_image"],
      },
    ],
  });

  // Get user's votes if authenticated
  let userVotes = {};
  if (studentId) {
    const votes = await ReviewHelpfulVote.findAll({
      where: {
        review_id: { [Op.in]: reviews.map((r) => r.id) },
        student_id: studentId,
      },
    });
    userVotes = votes.reduce((acc, vote) => {
      acc[vote.review_id] = vote.is_helpful;
      return acc;
    }, {});
  }

  // Calculate review statistics
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

  const statistics = stats[0] || {
    total_reviews: 0,
    average_rating: 0,
    five_star: 0,
    four_star: 0,
    three_star: 0,
    two_star: 0,
    one_star: 0,
  };

  res.status(200).json({
    success: true,
    message: "Reviews retrieved successfully",
    data: {
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        helpful_count: review.helpful_count,
        is_verified_purchase: review.is_verified_purchase,
        created_at: review.created_at,
        student: review.student
          ? {
              id: review.student.id,
              name: `${review.student.fname} ${review.student.lname || ""}`.trim(),
              profile_image: review.student.profile_image,
            }
          : null,
        user_voted_helpful: userVotes[review.id] === true,
        user_voted_not_helpful: userVotes[review.id] === false,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
      statistics: {
        total_reviews: parseInt(statistics.total_reviews || 0),
        average_rating: parseFloat(statistics.average_rating || 0).toFixed(1),
        rating_distribution: {
          five_star: parseInt(statistics.five_star || 0),
          four_star: parseInt(statistics.four_star || 0),
          three_star: parseInt(statistics.three_star || 0),
          two_star: parseInt(statistics.two_star || 0),
          one_star: parseInt(statistics.one_star || 0),
        },
      },
    },
  });
});

/**
 * Mark review as helpful/not helpful
 * POST /api/marketplace/reviews/:id/helpful
 */
export const markReviewHelpful = TryCatchFunction(async (req, res) => {
  const studentId = req.user.id;
  const { id } = req.params;
  const { is_helpful = true } = req.body;

  // Find review
  const review = await ProductReview.findByPk(id);
  if (!review) {
    throw new ErrorClass("Review not found", 404);
  }

  // Check if student already voted
  const existingVote = await ReviewHelpfulVote.findOne({
    where: {
      review_id: id,
      student_id: studentId,
    },
  });

  const transaction = await db.transaction();

  try {
    if (existingVote) {
      // Update existing vote
      if (existingVote.is_helpful !== is_helpful) {
        // Vote changed - update helpful count
        const countChange = is_helpful ? 2 : -2; // +1 for new, -1 for old
        await review.update(
          { helpful_count: db.literal(`helpful_count + ${countChange}`) },
          { transaction }
        );
      }
      await existingVote.update({ is_helpful }, { transaction });
    } else {
      // Create new vote
      await ReviewHelpfulVote.create(
        {
          review_id: id,
          student_id: studentId,
          is_helpful,
        },
        { transaction }
      );

      // Update helpful count
      const countChange = is_helpful ? 1 : -1;
      await review.update(
        { helpful_count: db.literal(`helpful_count + ${countChange}`) },
        { transaction }
      );
    }

    await transaction.commit();

    // Reload review to get updated count
    await review.reload();

    res.status(200).json({
      success: true,
      message: `Review marked as ${is_helpful ? "helpful" : "not helpful"}`,
      data: {
        review_id: review.id,
        helpful_count: review.helpful_count,
        user_voted_helpful: is_helpful,
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Get user's review for a product
 * GET /api/marketplace/reviews/my-review?product_type=course&product_id=1
 */
export const getMyReview = TryCatchFunction(async (req, res) => {
  const studentId = req.user.id;
  const { product_type, product_id } = req.query;

  if (!product_type || !product_id) {
    throw new ErrorClass("product_type and product_id are required", 400);
  }

  const review = await ProductReview.findOne({
    where: {
      student_id: studentId,
      product_type,
      product_id: parseInt(product_id),
    },
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "mname", "profile_image"],
      },
    ],
  });

  if (!review) {
    return res.status(200).json({
      success: true,
      message: "No review found",
      data: {
        review: null,
      },
    });
  }

  res.status(200).json({
    success: true,
    message: "Review retrieved successfully",
    data: {
      review: {
        id: review.id,
        product_type: review.product_type,
        product_id: review.product_id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        helpful_count: review.helpful_count,
        is_verified_purchase: review.is_verified_purchase,
        created_at: review.created_at,
        updated_at: review.updated_at,
      },
    },
  });
});
