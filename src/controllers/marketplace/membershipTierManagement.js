/**
 * Membership Tier Management Controller
 * Handles CRUD operations for membership tiers by tutors
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Membership, MembershipTier, MembershipTierProduct } from "../../models/marketplace/index.js";
import { checkSubscriptionLimit, validateSubscriptionStatus } from "./tutorSubscription.js";
import { Op } from "sequelize";
import { Courses } from "../../models/course/courses.js";
import { EBooks } from "../../models/marketplace/ebooks.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { CoachingSession } from "../../models/marketplace/coachingSession.js";
import { Community } from "../../models/marketplace/community.js";

/**
 * Helper to get tutor info
 */
function getTutorInfo(req) {
  const userType = req.user.userType;
  let tutorId, tutorType;

  if (userType === "sole_tutor") {
    tutorId = req.tutor.id;
    tutorType = "sole_tutor";
  } else if (userType === "organization") {
    tutorId = req.tutor.id;
    tutorType = "organization";
  } else if (userType === "organization_user") {
    tutorId = req.tutor.organization_id;
    tutorType = "organization";
  } else {
    throw new ErrorClass("Invalid user type", 403);
  }

  return { tutorId, tutorType };
}

/**
 * Validate product ownership
 */
async function validateProductOwnership(tutorId, tutorType, productType, productId) {
  const ownerType = tutorType === "sole_tutor" ? "sole_tutor" : "organization";

  switch (productType) {
    case "course":
      const course = await Courses.findByPk(productId);
      if (!course || course.owner_id !== tutorId || course.owner_type !== ownerType) {
        throw new ErrorClass(`Course ${productId} not found or does not belong to you`, 404);
      }
      break;
    case "ebook":
      const ebook = await EBooks.findByPk(productId);
      if (!ebook || ebook.owner_id !== tutorId || ebook.owner_type !== ownerType) {
        throw new ErrorClass(`Ebook ${productId} not found or does not belong to you`, 404);
      }
      break;
    case "digital_download":
      const download = await DigitalDownloads.findByPk(productId);
      if (!download || download.owner_id !== tutorId || download.owner_type !== ownerType) {
        throw new ErrorClass(`Digital download ${productId} not found or does not belong to you`, 404);
      }
      break;
    case "coaching_session":
      const session = await CoachingSession.findByPk(productId);
      if (!session || session.tutor_id !== tutorId || session.tutor_type !== tutorType) {
        throw new ErrorClass(`Coaching session ${productId} not found or does not belong to you`, 404);
      }
      break;
    case "community":
      const community = await Community.findByPk(productId);
      if (!community || community.tutor_id !== tutorId || community.tutor_type !== tutorType) {
        throw new ErrorClass(`Community ${productId} not found or does not belong to you`, 404);
      }
      break;
    default:
      throw new ErrorClass(`Invalid product type: ${productType}`, 400);
  }
}

/**
 * Create a new tier for a membership
 * POST /api/marketplace/tutor/memberships/:id/tiers
 */
export const createTier = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id: membershipId } = req.params;

  // Check if tutor subscription is active
  const statusCheck = await validateSubscriptionStatus(tutorId, tutorType);
  if (!statusCheck.allowed) {
    throw new ErrorClass(statusCheck.reason, 403);
  }

  // Verify membership belongs to tutor
  const membership = await Membership.findOne({
    where: {
      id: membershipId,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  const {
    tier_name,
    description,
    monthly_price,
    yearly_price,
    lifetime_price,
    currency = "NGN",
    display_order = 0,
  } = req.body;

  if (!tier_name) {
    throw new ErrorClass("Tier name is required", 400);
  }

  // Check if tier name already exists for this membership
  const existingTier = await MembershipTier.findOne({
    where: {
      membership_id: membershipId,
      tier_name: tier_name.trim(),
    },
  });

  if (existingTier) {
    throw new ErrorClass(`Tier name "${tier_name}" already exists for this membership`, 400);
  }

  // Validate at least one price is provided
  const hasMonthly = monthly_price !== undefined && monthly_price !== null;
  const hasYearly = yearly_price !== undefined && yearly_price !== null;
  const hasLifetime = lifetime_price !== undefined && lifetime_price !== null;

  if (!hasMonthly && !hasYearly && !hasLifetime) {
    throw new ErrorClass("At least one pricing option (monthly, yearly, or lifetime) must be provided", 400);
  }

  // Validate prices are non-negative
  if (hasMonthly && parseFloat(monthly_price) < 0) {
    throw new ErrorClass("Monthly price must be 0 or greater", 400);
  }
  if (hasYearly && parseFloat(yearly_price) < 0) {
    throw new ErrorClass("Yearly price must be 0 or greater", 400);
  }
  if (hasLifetime && parseFloat(lifetime_price) < 0) {
    throw new ErrorClass("Lifetime price must be 0 or greater", 400);
  }

  // Create tier
  const tier = await MembershipTier.create({
    membership_id: membershipId,
    tier_name: tier_name.trim(),
    description: description || null,
    monthly_price: hasMonthly ? parseFloat(monthly_price) : null,
    yearly_price: hasYearly ? parseFloat(yearly_price) : null,
    lifetime_price: hasLifetime ? parseFloat(lifetime_price) : null,
    currency,
    display_order: parseInt(display_order) || 0,
    status: "active",
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "Tier created successfully",
    data: tier,
  });
});

/**
 * Get all tiers for a membership
 * GET /api/marketplace/tutor/memberships/:id/tiers
 */
export const getMembershipTiers = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id: membershipId } = req.params;

  // Verify membership belongs to tutor
  const membership = await Membership.findOne({
    where: {
      id: membershipId,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  const tiers = await MembershipTier.findAll({
    where: {
      membership_id: membershipId,
    },
    include: [
      {
        model: MembershipTierProduct,
        as: "products",
        attributes: ["id", "product_type", "product_id", "monthly_access_level", "yearly_access_level", "lifetime_access_level"],
      },
    ],
    order: [["display_order", "ASC"], ["created_at", "ASC"]],
  });

  res.json({
    status: true,
    code: 200,
    message: "Tiers retrieved successfully",
    data: tiers,
  });
});

/**
 * Get single tier
 * GET /api/marketplace/tutor/memberships/:id/tiers/:tierId
 */
export const getTier = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id: membershipId, tierId } = req.params;

  // Verify membership belongs to tutor
  const membership = await Membership.findOne({
    where: {
      id: membershipId,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  const tier = await MembershipTier.findOne({
    where: {
      id: tierId,
      membership_id: membershipId,
    },
    include: [
      {
        model: MembershipTierProduct,
        as: "products",
        attributes: ["id", "product_type", "product_id", "monthly_access_level", "yearly_access_level", "lifetime_access_level"],
      },
    ],
  });

  if (!tier) {
    throw new ErrorClass("Tier not found", 404);
  }

  res.json({
    status: true,
    code: 200,
    message: "Tier retrieved successfully",
    data: tier,
  });
});

/**
 * Update tier
 * PUT /api/marketplace/tutor/memberships/:id/tiers/:tierId
 */
export const updateTier = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id: membershipId, tierId } = req.params;

  // Check if tutor subscription is active
  const statusCheck = await validateSubscriptionStatus(tutorId, tutorType);
  if (!statusCheck.allowed) {
    throw new ErrorClass(statusCheck.reason, 403);
  }

  // Verify membership belongs to tutor
  const membership = await Membership.findOne({
    where: {
      id: membershipId,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  const tier = await MembershipTier.findOne({
    where: {
      id: tierId,
      membership_id: membershipId,
    },
  });

  if (!tier) {
    throw new ErrorClass("Tier not found", 404);
  }

  const {
    tier_name,
    description,
    monthly_price,
    yearly_price,
    lifetime_price,
    currency,
    display_order,
    status,
  } = req.body;

  // If tier name is being changed, check uniqueness
  if (tier_name !== undefined && tier_name.trim() !== tier.tier_name) {
    const existingTier = await MembershipTier.findOne({
      where: {
        membership_id: membershipId,
        tier_name: tier_name.trim(),
        id: { [Op.ne]: tierId },
      },
    });

    if (existingTier) {
      throw new ErrorClass(`Tier name "${tier_name}" already exists for this membership`, 400);
    }
    tier.tier_name = tier_name.trim();
  }

  if (description !== undefined) tier.description = description || null;
  if (monthly_price !== undefined) {
    const price = parseFloat(monthly_price);
    if (price < 0) {
      throw new ErrorClass("Monthly price must be 0 or greater", 400);
    }
    tier.monthly_price = price;
  }
  if (yearly_price !== undefined) {
    const price = parseFloat(yearly_price);
    if (price < 0) {
      throw new ErrorClass("Yearly price must be 0 or greater", 400);
    }
    tier.yearly_price = price;
  }
  if (lifetime_price !== undefined) {
    const price = parseFloat(lifetime_price);
    if (price < 0) {
      throw new ErrorClass("Lifetime price must be 0 or greater", 400);
    }
    tier.lifetime_price = price;
  }
  if (currency !== undefined) tier.currency = currency;
  if (display_order !== undefined) tier.display_order = parseInt(display_order) || 0;
  if (status !== undefined) {
    if (!["active", "inactive"].includes(status)) {
      throw new ErrorClass("Status must be 'active' or 'inactive'", 400);
    }
    tier.status = status;
  }

  await tier.save();

  // Reload with products
  await tier.reload({
    include: [
      {
        model: MembershipTierProduct,
        as: "products",
      },
    ],
  });

  res.json({
    status: true,
    code: 200,
    message: "Tier updated successfully",
    data: tier,
  });
});

/**
 * Delete tier (set status to inactive)
 * DELETE /api/marketplace/tutor/memberships/:id/tiers/:tierId
 */
export const deleteTier = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id: membershipId, tierId } = req.params;

  // Verify membership belongs to tutor
  const membership = await Membership.findOne({
    where: {
      id: membershipId,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  const tier = await MembershipTier.findOne({
    where: {
      id: tierId,
      membership_id: membershipId,
    },
  });

  if (!tier) {
    throw new ErrorClass("Tier not found", 404);
  }

  // Check if tier has active subscriptions
  const { MembershipSubscription } = await import("../../models/marketplace/index.js");
  const activeSubscriptions = await MembershipSubscription.count({
    where: {
      tier_id: tierId,
      status: "active",
    },
  });

  if (activeSubscriptions > 0) {
    // Set status to inactive instead of deleting
    tier.status = "inactive";
    await tier.save();
    res.json({
      status: true,
      code: 200,
      message: "Tier deactivated successfully (has active subscriptions)",
      data: tier,
    });
  } else {
    // No active subscriptions, can delete
    await tier.destroy();
    res.json({
      status: true,
      code: 200,
      message: "Tier deleted successfully",
    });
  }
});

/**
 * Bulk assign products to tiers
 * POST /api/marketplace/tutor/memberships/:id/tiers/products
 */
export const bulkAssignProductsToTiers = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id: membershipId } = req.params;

  // Check if tutor subscription is active
  const statusCheck = await validateSubscriptionStatus(tutorId, tutorType);
  if (!statusCheck.allowed) {
    throw new ErrorClass(statusCheck.reason, 403);
  }

  // Verify membership belongs to tutor
  const membership = await Membership.findOne({
    where: {
      id: membershipId,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  const { assignments } = req.body; // Array of { tier_id, products: [{ product_type, product_id, monthly_access_level, yearly_access_level, lifetime_access_level }] }

  if (!Array.isArray(assignments) || assignments.length === 0) {
    throw new ErrorClass("assignments must be a non-empty array", 400);
  }

  const results = [];
  const errors = [];

  for (const assignment of assignments) {
    const { tier_id, products } = assignment;

    if (!tier_id) {
      errors.push({ tier_id: "Tier ID is required" });
      continue;
    }

    if (!Array.isArray(products) || products.length === 0) {
      errors.push({ tier_id, error: "Products array is required and must not be empty" });
      continue;
    }

    // Verify tier belongs to membership
    const tier = await MembershipTier.findOne({
      where: {
        id: tier_id,
        membership_id: membershipId,
      },
    });

    if (!tier) {
      errors.push({ tier_id, error: "Tier not found" });
      continue;
    }

    const tierResults = [];

    for (const product of products) {
      const { product_type, product_id, monthly_access_level, yearly_access_level, lifetime_access_level } = product;

      if (!product_type || !product_id) {
        errors.push({ tier_id, product, error: "product_type and product_id are required" });
        continue;
      }

      try {
        // Validate product ownership
        await validateProductOwnership(tutorId, tutorType, product_type, product_id);

        // Check if product already exists in tier
        const existing = await MembershipTierProduct.findOne({
          where: {
            tier_id,
            product_type,
            product_id,
          },
        });

        if (existing) {
          // Update access levels
          existing.monthly_access_level = monthly_access_level || null;
          existing.yearly_access_level = yearly_access_level || null;
          existing.lifetime_access_level = lifetime_access_level || null;
          await existing.save();
          tierResults.push({ product_type, product_id, action: "updated" });
        } else {
          // Create new assignment
          const tierProduct = await MembershipTierProduct.create({
            tier_id,
            product_type,
            product_id,
            monthly_access_level: monthly_access_level || null,
            yearly_access_level: yearly_access_level || null,
            lifetime_access_level: lifetime_access_level || null,
          });
          tierResults.push({ product_type, product_id, action: "created" });
        }
      } catch (error) {
        errors.push({ tier_id, product, error: error.message });
      }
    }

    results.push({
      tier_id,
      tier_name: tier.tier_name,
      products_assigned: tierResults.length,
      products: tierResults,
    });
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: "Products assigned to tiers",
    data: {
      results,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
});

/**
 * Add single product to tier
 * POST /api/marketplace/tutor/memberships/:id/tiers/:tierId/products
 */
export const addProductToTier = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id: membershipId, tierId } = req.params;
  const { product_type, product_id, monthly_access_level, yearly_access_level, lifetime_access_level } = req.body;

  if (!product_type || !product_id) {
    throw new ErrorClass("product_type and product_id are required", 400);
  }

  // Verify membership belongs to tutor
  const membership = await Membership.findOne({
    where: {
      id: membershipId,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  // Verify tier belongs to membership
  const tier = await MembershipTier.findOne({
    where: {
      id: tierId,
      membership_id: membershipId,
    },
  });

  if (!tier) {
    throw new ErrorClass("Tier not found", 404);
  }

  // Validate product ownership
  await validateProductOwnership(tutorId, tutorType, product_type, product_id);

  // Check if product already exists in tier
  const existing = await MembershipTierProduct.findOne({
    where: {
      tier_id: tierId,
      product_type,
      product_id,
    },
  });

  if (existing) {
    throw new ErrorClass("Product already exists in this tier", 400);
  }

  // Add product to tier
  const tierProduct = await MembershipTierProduct.create({
    tier_id: tierId,
    product_type,
    product_id,
    monthly_access_level: monthly_access_level || null,
    yearly_access_level: yearly_access_level || null,
    lifetime_access_level: lifetime_access_level || null,
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "Product added to tier successfully",
    data: tierProduct,
  });
});

/**
 * Remove product from tier
 * DELETE /api/marketplace/tutor/memberships/:id/tiers/:tierId/products/:productId?product_type=course
 */
export const removeProductFromTier = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id: membershipId, tierId, productId } = req.params;
  const { product_type } = req.query;

  if (!product_type) {
    throw new ErrorClass("product_type query parameter is required", 400);
  }

  // Verify membership belongs to tutor
  const membership = await Membership.findOne({
    where: {
      id: membershipId,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  // Verify tier belongs to membership
  const tier = await MembershipTier.findOne({
    where: {
      id: tierId,
      membership_id: membershipId,
    },
  });

  if (!tier) {
    throw new ErrorClass("Tier not found", 404);
  }

  const tierProduct = await MembershipTierProduct.findOne({
    where: {
      tier_id: tierId,
      product_type,
      product_id: productId,
    },
  });

  if (!tierProduct) {
    throw new ErrorClass("Product not found in this tier", 404);
  }

  await tierProduct.destroy();

  res.json({
    status: true,
    code: 200,
    message: "Product removed from tier successfully",
  });
});
