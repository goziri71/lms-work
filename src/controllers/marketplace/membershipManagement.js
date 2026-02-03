/**
 * Membership Management Controller
 * Handles CRUD operations for memberships by tutors
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import {
  Membership,
  MembershipProduct,
  MembershipTier,
  MembershipTierProduct,
  MembershipSubscription,
  MembershipPayment,
  MembershipTierChange,
} from "../../models/marketplace/index.js";
import { db } from "../../database/database.js";
import {
  checkSubscriptionLimit,
  validateSubscriptionStatus,
} from "./tutorSubscription.js";
import { supabase } from "../../utils/supabase.js";
import multer from "multer";
import { Op } from "sequelize";
import { normalizeCategory } from "../../constants/categories.js";
import { Courses } from "../../models/course/courses.js";
import { EBooks } from "../../models/marketplace/ebooks.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { CoachingSession } from "../../models/marketplace/coachingSession.js";
import { Community } from "../../models/marketplace/community.js";
import { generateMembershipSlug } from "../../utils/productSlugHelper.js";

// Configure multer for membership image uploads
const uploadMembershipImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ErrorClass("Only JPEG, PNG, and WebP images are allowed", 400),
        false
      );
    }
  },
});

export const uploadMembershipImageMiddleware =
  uploadMembershipImage.single("image");

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
 * Create a new membership
 * POST /api/marketplace/tutor/memberships
 */
export const createMembership = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);

  // Check if tutor subscription is active
  const statusCheck = await validateSubscriptionStatus(tutorId, tutorType);
  if (!statusCheck.allowed) {
    throw new ErrorClass(statusCheck.reason, 403);
  }

  // Check subscription limits
  const limitCheck = await checkSubscriptionLimit(
    tutorId,
    tutorType,
    "membership"
  );
  if (!limitCheck.allowed) {
    throw new ErrorClass(limitCheck.reason, 403);
  }

  const {
    name,
    description,
    category,
    pricing_type, // Legacy field - kept for backward compatibility
    pricing_plan, // Alternative field name (for frontend compatibility)
    pricingType, // CamelCase from frontend
    price, // Legacy field - kept for backward compatibility
    currency = "NGN",
    products = [], // Legacy field - Array of { product_type, product_id }
    tiers = [], // New field - Array of tier objects with products
  } = req.body;

  if (!name) {
    throw new ErrorClass("Name is required", 400);
  }

  // Normalize pricing_type (handle pricing_type, pricing_plan, pricingType; default to monthly when missing)
  const normalizedPricingType =
    pricing_type || pricing_plan || pricingType || "monthly";

  // If tiers are provided, use tier system. Otherwise, use legacy pricing
  const useTierSystem = Array.isArray(tiers) && tiers.length > 0;

  // Normalize price value (handle free memberships without price)
  let normalizedPrice = price;

  if (!useTierSystem) {
    // Legacy validation (default already applied above)

    // Normalize the value (lowercase, trim)
    const pricingTypeValue = String(normalizedPricingType).toLowerCase().trim();

    if (!["free", "monthly", "yearly", "lifetime"].includes(pricingTypeValue)) {
      throw new ErrorClass(
        `pricing_type must be one of: free, monthly, yearly, lifetime. Received: "${normalizedPricingType}"`,
        400
      );
    }

    // For free memberships: if price is not provided, default to 0
    // If price is provided, it must be 0
    if (pricingTypeValue === "free") {
      if (
        normalizedPrice !== undefined &&
        normalizedPrice !== null &&
        normalizedPrice !== "" &&
        parseFloat(normalizedPrice) !== 0
      ) {
        throw new ErrorClass("Price must be 0 for free memberships", 400);
      }
      // Default to 0 if not provided
      normalizedPrice = 0;
    } else {
      // For paid memberships, price is required
      if (!normalizedPrice || parseFloat(normalizedPrice) <= 0) {
        throw new ErrorClass("Price is required for paid memberships", 400);
      }
    }
  }

  // Upload image if provided
  let imageUrl = null;
  if (req.file) {
    const bucket = process.env.MEMBERSHIPS_BUCKET || "memberships";

    // Check if bucket exists, create if it doesn't
    try {
      const { data: buckets, error: listError } =
        await supabase.storage.listBuckets();
      if (!listError) {
        const bucketExists = buckets?.some((b) => b.name === bucket);
        if (!bucketExists) {
          const { error: createError } = await supabase.storage.createBucket(
            bucket,
            {
              public: true,
              allowedMimeTypes: [
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
              ],
            }
          );
          if (createError) {
            console.error(
              `Failed to create bucket "${bucket}":`,
              createError.message
            );
            throw new ErrorClass(
              `Storage bucket "${bucket}" does not exist. Please create it in Supabase Storage settings. Error: ${createError.message}`,
              500
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof ErrorClass) {
        throw error;
      }
      console.warn("Could not verify bucket existence:", error.message);
    }

    const fileExt = req.file.originalname.split(".").pop();
    const fileName = `memberships/${tutorId}_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      if (
        error.message?.includes("Bucket not found") ||
        error.message?.includes("not found")
      ) {
        throw new ErrorClass(
          `Storage bucket "${bucket}" does not exist. Please create a bucket named "${bucket}" in your Supabase Storage settings.`,
          500
        );
      }
      throw new ErrorClass(`Image upload failed: ${error.message}`, 500);
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    imageUrl = urlData.publicUrl;
  }

  // Generate unique slug
  const slug = await generateMembershipSlug(name);

  // Create membership
  // When using tiers, use default pricing_type (monthly) since the field is NOT NULL
  // The actual pricing is stored in the tiers table
  const membership = await Membership.create({
    tutor_id: tutorId,
    tutor_type: tutorType,
    name,
    slug: slug,
    description: description || null,
    category: category ? normalizeCategory(category) : null,
    image_url: imageUrl,
    pricing_type: useTierSystem
      ? "monthly"
      : String(normalizedPricingType).toLowerCase().trim() || "monthly", // Use default if using tiers
    price: useTierSystem ? 0 : parseFloat(normalizedPrice) || 0, // Use 0 if using tiers (pricing is in tiers)
    currency,
    status: "active",
    commission_rate: 0, // No commission for memberships
  });

  // Create tiers if provided
  if (useTierSystem) {
    for (let i = 0; i < tiers.length; i++) {
      const tierData = tiers[i];
      const {
        tier_name,
        description: tierDescription,
        monthly_price,
        yearly_price,
        lifetime_price,
        tier_currency = currency,
        display_order = i,
        products: tierProducts = [],
      } = tierData;

      if (!tier_name) {
        throw new ErrorClass(
          `Tier name is required for tier at index ${i}`,
          400
        );
      }

      // Check if tier name already exists
      const existingTier = await MembershipTier.findOne({
        where: {
          membership_id: membership.id,
          tier_name: tier_name.trim(),
        },
      });

      if (existingTier) {
        throw new ErrorClass(`Tier name "${tier_name}" already exists`, 400);
      }

      // Validate at least one price is provided
      const hasMonthly = monthly_price !== undefined && monthly_price !== null;
      const hasYearly = yearly_price !== undefined && yearly_price !== null;
      const hasLifetime =
        lifetime_price !== undefined && lifetime_price !== null;

      if (!hasMonthly && !hasYearly && !hasLifetime) {
        throw new ErrorClass(
          `At least one pricing option must be provided for tier "${tier_name}"`,
          400
        );
      }

      // Validate prices are non-negative
      if (hasMonthly && parseFloat(monthly_price) < 0) {
        throw new ErrorClass(
          `Monthly price must be 0 or greater for tier "${tier_name}"`,
          400
        );
      }
      if (hasYearly && parseFloat(yearly_price) < 0) {
        throw new ErrorClass(
          `Yearly price must be 0 or greater for tier "${tier_name}"`,
          400
        );
      }
      if (hasLifetime && parseFloat(lifetime_price) < 0) {
        throw new ErrorClass(
          `Lifetime price must be 0 or greater for tier "${tier_name}"`,
          400
        );
      }

      // Create tier
      const tier = await MembershipTier.create({
        membership_id: membership.id,
        tier_name: tier_name.trim(),
        description: tierDescription || null,
        monthly_price: hasMonthly ? parseFloat(monthly_price) : null,
        yearly_price: hasYearly ? parseFloat(yearly_price) : null,
        lifetime_price: hasLifetime ? parseFloat(lifetime_price) : null,
        currency: tier_currency,
        display_order: parseInt(display_order) || i,
        status: "active",
      });

      // Add products to tier if provided
      if (Array.isArray(tierProducts) && tierProducts.length > 0) {
        for (const product of tierProducts) {
          const {
            product_type,
            product_id,
            monthly_access_level,
            yearly_access_level,
            lifetime_access_level,
          } = product;

          if (!product_type || !product_id) {
            throw new ErrorClass(
              `product_type and product_id are required for products in tier "${tier_name}"`,
              400
            );
          }

          // Validate product ownership
          await validateProductOwnership(
            tutorId,
            tutorType,
            product_type,
            product_id
          );

          // Create tier product
          await MembershipTierProduct.create({
            tier_id: tier.id,
            product_type,
            product_id,
            monthly_access_level: monthly_access_level || null,
            yearly_access_level: yearly_access_level || null,
            lifetime_access_level: lifetime_access_level || null,
          });
        }
      }
    }
  } else {
    // Legacy: Add products directly to membership if provided
    if (Array.isArray(products) && products.length > 0) {
      const productPromises = products.map(async (product) => {
        const { product_type, product_id } = product;

        // Validate product exists and belongs to tutor
        await validateProductOwnership(
          tutorId,
          tutorType,
          product_type,
          product_id
        );

        return MembershipProduct.create({
          membership_id: membership.id,
          product_type,
          product_id,
        });
      });

      await Promise.all(productPromises);
    }
  }

  // Reload membership with products and tiers
  await membership.reload({
    include: [
      {
        model: MembershipProduct,
        as: "products",
      },
      {
        model: MembershipTier,
        as: "tiers",
        include: [
          {
            model: MembershipTierProduct,
            as: "products",
          },
        ],
      },
    ],
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "Membership created successfully",
    data: membership,
  });
});

/**
 * Validate product ownership
 */
async function validateProductOwnership(
  tutorId,
  tutorType,
  productType,
  productId
) {
  const ownerType = tutorType === "sole_tutor" ? "sole_tutor" : "organization";

  switch (productType) {
    case "course":
      const course = await Courses.findByPk(productId);
      if (
        !course ||
        course.owner_id !== tutorId ||
        course.owner_type !== ownerType
      ) {
        throw new ErrorClass(
          `Course ${productId} not found or does not belong to you`,
          404
        );
      }
      break;
    case "ebook":
      const ebook = await EBooks.findByPk(productId);
      if (
        !ebook ||
        ebook.owner_id !== tutorId ||
        ebook.owner_type !== ownerType
      ) {
        throw new ErrorClass(
          `Ebook ${productId} not found or does not belong to you`,
          404
        );
      }
      break;
    case "digital_download":
      const download = await DigitalDownloads.findByPk(productId);
      if (
        !download ||
        download.owner_id !== tutorId ||
        download.owner_type !== ownerType
      ) {
        throw new ErrorClass(
          `Digital download ${productId} not found or does not belong to you`,
          404
        );
      }
      break;
    case "coaching_session":
      const session = await CoachingSession.findByPk(productId);
      if (
        !session ||
        session.tutor_id !== tutorId ||
        session.tutor_type !== tutorType
      ) {
        throw new ErrorClass(
          `Coaching session ${productId} not found or does not belong to you`,
          404
        );
      }
      break;
    case "community":
      const community = await Community.findByPk(productId);
      if (
        !community ||
        community.tutor_id !== tutorId ||
        community.tutor_type !== tutorType
      ) {
        throw new ErrorClass(
          `Community ${productId} not found or does not belong to you`,
          404
        );
      }
      break;
    default:
      throw new ErrorClass(`Invalid product type: ${productType}`, 400);
  }
}

/**
 * Get all memberships for tutor
 * GET /api/marketplace/tutor/memberships
 */
export const getMyMemberships = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);

  const memberships = await Membership.findAll({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
    include: [
      {
        model: MembershipProduct,
        as: "products",
      },
    ],
    order: [["created_at", "DESC"]],
  });

  res.json({
    status: true,
    code: 200,
    message: "Memberships retrieved successfully",
    data: memberships,
  });
});

/**
 * Get single membership
 * GET /api/marketplace/tutor/memberships/:id
 */
export const getMembership = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const membership = await Membership.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
    include: [
      {
        model: MembershipProduct,
        as: "products",
      },
    ],
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  res.json({
    status: true,
    code: 200,
    message: "Membership retrieved successfully",
    data: membership,
  });
});

/**
 * Update membership
 * PUT /api/marketplace/tutor/memberships/:id
 */
export const updateMembership = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  // Check if tutor subscription is active
  const statusCheck = await validateSubscriptionStatus(tutorId, tutorType);
  if (!statusCheck.allowed) {
    throw new ErrorClass(statusCheck.reason, 403);
  }

  const membership = await Membership.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  const { name, description, category, pricing_type, price, currency } =
    req.body;

  // Regenerate slug if name changed
  if (name !== undefined && name !== membership.name) {
    membership.slug = await generateMembershipSlug(name, membership.id);
  }

  // Upload new image if provided
  if (req.file) {
    // Delete old image if exists
    if (membership.image_url) {
      try {
        const urlParts = membership.image_url.split("/");
        const fileName = urlParts[urlParts.length - 1];
        const bucket = process.env.MEMBERSHIPS_BUCKET || "memberships";
        await supabase.storage.from(bucket).remove([`memberships/${fileName}`]);
      } catch (error) {
        console.error("Error deleting old image:", error);
      }
    }

    const bucket = process.env.MEMBERSHIPS_BUCKET || "memberships";
    const fileExt = req.file.originalname.split(".").pop();
    const fileName = `memberships/${tutorId}_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      if (
        error.message?.includes("Bucket not found") ||
        error.message?.includes("not found")
      ) {
        throw new ErrorClass(
          `Storage bucket "${bucket}" does not exist. Please create a bucket named "${bucket}" in your Supabase Storage settings.`,
          500
        );
      }
      throw new ErrorClass(`Image upload failed: ${error.message}`, 500);
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    membership.image_url = urlData.publicUrl;
  }

  // Update fields
  if (name !== undefined) membership.name = name;
  if (description !== undefined) membership.description = description;
  if (category !== undefined)
    membership.category = category ? normalizeCategory(category) : null;
  if (pricing_type !== undefined) {
    if (!["free", "monthly", "yearly", "lifetime"].includes(pricing_type)) {
      throw new ErrorClass(
        "pricing_type must be one of: free, monthly, yearly, lifetime",
        400
      );
    }
    membership.pricing_type = pricing_type;
  }
  if (price !== undefined) {
    const priceValue = parseFloat(price);
    if (membership.pricing_type === "free" && priceValue !== 0) {
      throw new ErrorClass("Price must be 0 for free memberships", 400);
    }
    if (membership.pricing_type !== "free" && priceValue <= 0) {
      throw new ErrorClass(
        "Price must be greater than 0 for paid memberships",
        400
      );
    }
    membership.price = priceValue;
  }
  if (currency !== undefined) membership.currency = currency;

  await membership.save();

  // Reload with products
  await membership.reload({
    include: [
      {
        model: MembershipProduct,
        as: "products",
      },
    ],
  });

  res.json({
    status: true,
    code: 200,
    message: "Membership updated successfully",
    data: membership,
  });
});

/**
 * Add product to membership
 * POST /api/marketplace/tutor/memberships/:id/products
 */
export const addProductToMembership = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;
  const { product_type, product_id } = req.body;

  if (!product_type || !product_id) {
    throw new ErrorClass("product_type and product_id are required", 400);
  }

  const membership = await Membership.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  // Check if product already exists
  const existing = await MembershipProduct.findOne({
    where: {
      membership_id: id,
      product_type,
      product_id,
    },
  });

  if (existing) {
    throw new ErrorClass("Product already exists in this membership", 400);
  }

  // Validate product ownership
  await validateProductOwnership(tutorId, tutorType, product_type, product_id);

  // Add product
  const membershipProduct = await MembershipProduct.create({
    membership_id: id,
    product_type,
    product_id,
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "Product added to membership successfully",
    data: membershipProduct,
  });
});

/**
 * Remove product from membership
 * DELETE /api/marketplace/tutor/memberships/:id/products/:productId
 */
export const removeProductFromMembership = TryCatchFunction(
  async (req, res) => {
    const { tutorId, tutorType } = getTutorInfo(req);
    const { id, productId } = req.params;
    const { product_type } = req.query; // Required query param

    if (!product_type) {
      throw new ErrorClass("product_type query parameter is required", 400);
    }

    const membership = await Membership.findOne({
      where: {
        id,
        tutor_id: tutorId,
        tutor_type: tutorType,
      },
    });

    if (!membership) {
      throw new ErrorClass("Membership not found", 404);
    }

    const membershipProduct = await MembershipProduct.findOne({
      where: {
        membership_id: id,
        product_type,
        product_id: productId,
      },
    });

    if (!membershipProduct) {
      throw new ErrorClass("Product not found in this membership", 404);
    }

    await membershipProduct.destroy();

    res.json({
      status: true,
      code: 200,
      message: "Product removed from membership successfully",
    });
  }
);

/**
 * Delete membership (hard delete - remove from database)
 * DELETE /api/marketplace/tutor/memberships/:id
 */
export const deleteMembership = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const membership = await Membership.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  const membershipId = membership.id;

  const transaction = await db.transaction();
  try {
    // Get subscription ids for this membership (for tier changes and payments)
    const subscriptions = await MembershipSubscription.findAll({
      where: { membership_id: membershipId },
      attributes: ["id"],
      transaction,
    });
    const subscriptionIds = subscriptions.map((s) => s.id);

    if (subscriptionIds.length > 0) {
      await MembershipTierChange.destroy({
        where: { subscription_id: { [Op.in]: subscriptionIds } },
        transaction,
      });
      await MembershipPayment.destroy({
        where: { subscription_id: { [Op.in]: subscriptionIds } },
        transaction,
      });
    }

    await MembershipSubscription.destroy({
      where: { membership_id: membershipId },
      transaction,
    });

    const tiers = await MembershipTier.findAll({
      where: { membership_id: membershipId },
      attributes: ["id"],
      transaction,
    });
    const tierIds = tiers.map((t) => t.id);
    if (tierIds.length > 0) {
      await MembershipTierProduct.destroy({
        where: { tier_id: { [Op.in]: tierIds } },
        transaction,
      });
    }

    await MembershipTier.destroy({
      where: { membership_id: membershipId },
      transaction,
    });

    await MembershipProduct.destroy({
      where: { membership_id: membershipId },
      transaction,
    });

    await membership.destroy({ transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  res.json({
    status: true,
    code: 200,
    message: "Membership deleted successfully",
  });
});
