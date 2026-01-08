import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TutorSubscription, SUBSCRIPTION_TIERS } from "../../models/marketplace/tutorSubscription.js";
import { Courses } from "../../models/course/courses.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { TutorWalletTransaction } from "../../models/marketplace/tutorWalletTransaction.js";
import { db } from "../../database/database.js";
import { Op } from "sequelize";

/**
 * Helper to get tutor ID and type from request
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
    // For org users, use the organization's ID
    tutorId = req.tutor.organization_id;
    tutorType = "organization";
  } else {
    throw new ErrorClass("Invalid user type", 403);
  }

  return { tutorId, tutorType };
}

/**
 * Get current subscription
 * GET /api/marketplace/tutor/subscription
 */
export const getSubscription = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);

  // Check and auto-expire if needed
  await checkSubscriptionExpiration(tutorId, tutorType);

  let subscription;
  try {
    subscription = await TutorSubscription.findOne({
      where: {
        tutor_id: tutorId,
        tutor_type: tutorType,
        status: "active",
      },
    });
  } catch (error) {
    if (error.name === 'SequelizeDatabaseError' && (error.message.includes('does not exist') || (error.message.includes('relation') && error.message.includes('does not exist')))) {
      throw new ErrorClass("Subscription tables not found. Please run the migration script: node scripts/migrate-create-coaching-subscription-tables.js", 500);
    }
    throw error;
  }

  if (!subscription) {
    // Return default free tier
    const freeTier = SUBSCRIPTION_TIERS.free;
    return res.json({
      success: true,
      data: {
        subscription_tier: "free",
        status: "active",
        ...freeTier,
        start_date: null,
        end_date: null,
        auto_renew: false,
      },
    });
  }

  // Check if subscription has expired (double-check)
  if (subscription.end_date) {
    const now = new Date();
    const endDate = new Date(subscription.end_date);
    if (now > endDate) {
      // Auto-expire
      await subscription.update({ status: "expired" });
      // Return free tier
      const freeTier = SUBSCRIPTION_TIERS.free;
      return res.json({
        success: true,
        data: {
          subscription_tier: "free",
          status: "expired",
          previous_tier: subscription.subscription_tier,
          message: "Your subscription has expired. Please renew to continue using premium features.",
          ...freeTier,
          start_date: null,
          end_date: null,
          auto_renew: false,
        },
      });
    }
  }

  const tierInfo = SUBSCRIPTION_TIERS[subscription.subscription_tier] || SUBSCRIPTION_TIERS.free;

  res.json({
    success: true,
    data: {
      id: subscription.id,
      subscription_tier: subscription.subscription_tier,
      tier_name: tierInfo.name,
      status: subscription.status,
      start_date: subscription.start_date,
      end_date: subscription.end_date,
      auto_renew: subscription.auto_renew,
      courses_limit: subscription.courses_limit,
      communities_limit: subscription.communities_limit,
      digital_downloads_limit: subscription.digital_downloads_limit,
      memberships_limit: subscription.memberships_limit,
      unlimited_coaching: subscription.unlimited_coaching,
      commission_rate: parseFloat(subscription.commission_rate),
      ...tierInfo,
    },
  });
});

/**
 * Subscribe to a tier
 * POST /api/marketplace/tutor/subscription
 * Body: { subscription_tier }
 */
export const subscribe = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { subscription_tier } = req.body;

  if (!subscription_tier || !SUBSCRIPTION_TIERS[subscription_tier]) {
    throw new ErrorClass("Invalid subscription tier", 400);
  }

  const tierInfo = SUBSCRIPTION_TIERS[subscription_tier];

  // Check if there's an active subscription
  let existingSubscription;
  try {
    existingSubscription = await TutorSubscription.findOne({
      where: {
        tutor_id: tutorId,
        tutor_type: tutorType,
        status: "active",
      },
    });
  } catch (error) {
    if (error.name === 'SequelizeDatabaseError' && (error.message.includes('does not exist') || (error.message.includes('relation') && error.message.includes('does not exist')))) {
      throw new ErrorClass("Subscription tables not found. Please run the migration script: node scripts/migrate-create-coaching-subscription-tables.js", 500);
    }
    throw error;
  }

  // Handle payment for subscription (wallet payment required)
  // Subscription prices are in USD, convert to tutor's local currency
  const subscriptionPriceUSD = tierInfo.price;
  
  // Get tutor wallet balance and currency
  let tutor;
  if (tutorType === "sole_tutor") {
    tutor = await SoleTutor.findByPk(tutorId);
  } else {
    tutor = await Organization.findByPk(tutorId);
  }

  if (!tutor) {
    throw new ErrorClass("Tutor not found", 404);
  }

  const tutorCurrency = (tutor.currency || "NGN").toUpperCase();
  const walletBalance = parseFloat(tutor.wallet_balance || 0);

  // Convert USD price to tutor's local currency
  let subscriptionPrice = subscriptionPriceUSD;
  let currency = "USD";
  
  if (subscriptionPriceUSD > 0 && tutorCurrency !== "USD") {
    // Import FX conversion service
    const { convertCurrency } = await import("../../services/fxConversionService.js");
    try {
      const conversion = await convertCurrency(subscriptionPriceUSD, "USD", tutorCurrency);
      subscriptionPrice = conversion.convertedAmount;
      currency = tutorCurrency;
    } catch (error) {
      console.error("FX conversion error:", error);
      // Fallback: Use a simple exchange rate if FX service fails
      // Default rates (approximate, should be updated from FX service)
      const defaultRates = {
        NGN: 1500,
        GHS: 12,
        KES: 130,
        ZAR: 18,
        GBP: 0.8,
        EUR: 0.92,
      };
      const rate = defaultRates[tutorCurrency] || 1;
      subscriptionPrice = subscriptionPriceUSD * rate;
      currency = tutorCurrency;
    }
  } else if (subscriptionPriceUSD > 0) {
    currency = "USD";
  } else {
    currency = tutorCurrency; // For free tier, use tutor's currency
  }

  // Free tier doesn't require payment
  if (subscriptionPrice > 0) {

    // Check if wallet has sufficient balance
    if (walletBalance < subscriptionPrice) {
      throw new ErrorClass(
        `Insufficient wallet balance. Required: ${subscriptionPrice} ${currency}, Available: ${walletBalance} ${currency}. Please fund your wallet first.`,
        400
      );
    }

    // Use transaction to ensure atomicity
    const transaction = await db.transaction();

    try {
      // Deduct from wallet
      const newBalance = walletBalance - subscriptionPrice;
      await tutor.update({ wallet_balance: newBalance }, { transaction });

      // Create subscription record
      const subscriptionData = {
        tutor_id: tutorId,
        tutor_type: tutorType,
        subscription_tier,
        status: "active",
        courses_limit: tierInfo.courses_limit,
        communities_limit: tierInfo.communities_limit,
        digital_downloads_limit: tierInfo.digital_downloads_limit,
        memberships_limit: tierInfo.memberships_limit,
        unlimited_coaching: tierInfo.unlimited_coaching,
        commission_rate: tierInfo.commission_rate,
        start_date: new Date(),
        // For monthly subscriptions, set end_date to 30 days from now
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        auto_renew: true,
      };

      let subscription;
      if (existingSubscription) {
        // Update existing subscription
        await existingSubscription.update(subscriptionData, { transaction });
        subscription = existingSubscription;
      } else {
        // Create new subscription
        subscription = await TutorSubscription.create(subscriptionData, { transaction });
      }

      // Create wallet transaction record
      await TutorWalletTransaction.create(
        {
          tutor_id: tutorId,
          tutor_type: tutorType,
          transaction_type: "debit",
          amount: subscriptionPrice,
          currency: currency,
          service_name: `Subscription Payment - ${subscription_tier}`,
          balance_before: walletBalance,
          balance_after: newBalance,
          related_id: subscription.id,
          related_type: "subscription",
          status: "successful",
        },
        { transaction }
      );

      await transaction.commit();

      res.json({
        success: true,
        message: "Subscription activated successfully",
        data: {
          ...subscription.toJSON(),
          payment_amount: subscriptionPrice,
          currency,
          original_price_usd: subscriptionPriceUSD,
          converted_price: subscriptionPrice,
          converted_currency: currency,
          new_wallet_balance: newBalance,
        },
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } else {
    // Free tier - no payment required, but track start date for 30-day limit
    const subscriptionData = {
      tutor_id: tutorId,
      tutor_type: tutorType,
      subscription_tier: "free",
      status: "active",
      courses_limit: tierInfo.courses_limit,
      communities_limit: tierInfo.communities_limit,
      digital_downloads_limit: tierInfo.digital_downloads_limit,
      memberships_limit: tierInfo.memberships_limit,
      unlimited_coaching: tierInfo.unlimited_coaching,
      commission_rate: tierInfo.commission_rate,
      start_date: new Date(),
      // Free tier expires after 30 days
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      auto_renew: false,
    };

    let subscription;
    if (existingSubscription) {
      // Update existing subscription
      await existingSubscription.update(subscriptionData);
      subscription = existingSubscription;
    } else {
      // Create new subscription
      subscription = await TutorSubscription.create(subscriptionData);
    }

    res.json({
      success: true,
      message: "Free tier subscription activated",
      data: subscription,
    });
  }
});

/**
 * Get subscription limits and current usage
 * GET /api/marketplace/tutor/subscription/limits
 */
export const getSubscriptionLimits = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);

  let subscription;
  try {
    subscription = await TutorSubscription.findOne({
      where: {
        tutor_id: tutorId,
        tutor_type: tutorType,
        status: "active",
      },
    });
  } catch (error) {
    if (error.name === 'SequelizeDatabaseError' && (error.message.includes('does not exist') || (error.message.includes('relation') && error.message.includes('does not exist')))) {
      throw new ErrorClass("Subscription tables not found. Please run the migration script: node scripts/migrate-create-coaching-subscription-tables.js", 500);
    }
    throw error;
  }

  const tierInfo = subscription
    ? SUBSCRIPTION_TIERS[subscription.subscription_tier]
    : SUBSCRIPTION_TIERS.free;

  // Get current usage
  const coursesCount = await Courses.count({
    where: {
      owner_id: tutorId,
      owner_type: tutorType === "sole_tutor" ? "sole_tutor" : "organization",
    },
  });

  const digitalDownloadsCount = await DigitalDownloads.count({
    where: {
      owner_id: tutorId,
      owner_type: tutorType === "sole_tutor" ? "sole_tutor" : "organization",
    },
  });

  // TODO: Add communities and memberships counts when implemented

  const limits = {
    courses: {
      limit: tierInfo.courses_limit,
      used: coursesCount,
      remaining: tierInfo.courses_limit ? tierInfo.courses_limit - coursesCount : null,
      unlimited: tierInfo.courses_limit === null,
    },
    digital_downloads: {
      limit: tierInfo.digital_downloads_limit,
      used: digitalDownloadsCount,
      remaining: tierInfo.digital_downloads_limit
        ? tierInfo.digital_downloads_limit - digitalDownloadsCount
        : null,
      unlimited: tierInfo.digital_downloads_limit === null,
    },
    communities: {
      limit: tierInfo.communities_limit,
      used: 0, // TODO: Implement when communities feature is ready
      remaining: tierInfo.communities_limit ? tierInfo.communities_limit - 0 : null,
      unlimited: tierInfo.communities_limit === null,
    },
    memberships: {
      limit: tierInfo.memberships_limit,
      used: 0, // TODO: Implement when memberships feature is ready
      remaining: tierInfo.memberships_limit ? tierInfo.memberships_limit - 0 : null,
      unlimited: tierInfo.memberships_limit === null,
    },
    coaching: {
      unlimited: tierInfo.unlimited_coaching,
    },
  };

  res.json({
    success: true,
    data: limits,
  });
});

/**
 * Check if subscription is expired
 * Internal helper function
 */
export async function checkSubscriptionExpiration(tutorId, tutorType) {
  const subscription = await TutorSubscription.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: { [Op.in]: ["active", "pending"] },
    },
  });

  if (!subscription) {
    // No subscription = free tier (check if free tier expired)
    return { expired: false, isFreeTier: true };
  }

  // Check if subscription has expired
  if (subscription.end_date) {
    const now = new Date();
    const endDate = new Date(subscription.end_date);

    if (now > endDate) {
      // Subscription expired - auto-expire it
      await subscription.update({ status: "expired" });
      return {
        expired: true,
        isFreeTier: subscription.subscription_tier === "free",
        reason: "Your subscription has expired. Please renew to continue using premium features.",
      };
    }
  }

  return { expired: false, isFreeTier: subscription.subscription_tier === "free", subscription };
}

/**
 * Validate subscription status before resource creation
 * Internal helper function
 */
export async function validateSubscriptionStatus(tutorId, tutorType) {
  const expirationCheck = await checkSubscriptionExpiration(tutorId, tutorType);

  if (expirationCheck.expired) {
    return {
      allowed: false,
      reason: expirationCheck.reason || "Your subscription has expired. Please renew to continue.",
    };
  }

  // Check if subscription exists and is active
  const subscription = await TutorSubscription.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: "active",
    },
  });

  if (!subscription) {
    // No active subscription = free tier
    // Check if free tier has expired (30-day limit)
    // For free tier, we need to check if they've been on free tier for more than 30 days
    // Since there's no subscription record, we can't track this easily
    // So we allow it (free tier is always available, but with limits)
    return { allowed: true, reason: null, isFreeTier: true };
  }

  // Check if subscription is still valid
  if (subscription.end_date) {
    const now = new Date();
    const endDate = new Date(subscription.end_date);

    if (now > endDate) {
      // Should have been caught by checkSubscriptionExpiration, but double-check
      await subscription.update({ status: "expired" });
      return {
        allowed: false,
        reason: "Your subscription has expired. Please renew to continue.",
      };
    }
  }

  // For free tier, check if 30 days have passed
  if (subscription.subscription_tier === "free" && subscription.end_date) {
    const now = new Date();
    const endDate = new Date(subscription.end_date);
    if (now > endDate) {
      await subscription.update({ status: "expired" });
      return {
        allowed: false,
        reason: "Your free tier subscription has expired (30-day limit). Please upgrade to a paid subscription to continue creating resources.",
      };
    }
  }

  return { allowed: true, reason: null, subscription };
}

/**
 * Check if tutor can perform an action (e.g., create course)
 * Internal helper function
 */
export async function checkSubscriptionLimit(tutorId, tutorType, resourceType) {
  // First check if subscription is expired
  const statusCheck = await validateSubscriptionStatus(tutorId, tutorType);
  if (!statusCheck.allowed) {
    return statusCheck;
  }

  const subscription = await TutorSubscription.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: "active",
    },
  });

  const tierInfo = subscription
    ? SUBSCRIPTION_TIERS[subscription.subscription_tier]
    : SUBSCRIPTION_TIERS.free;

  let limit, currentCount;

  switch (resourceType) {
    case "course":
      limit = tierInfo.courses_limit;
      currentCount = await Courses.count({
        where: {
          owner_id: tutorId,
          owner_type: tutorType === "sole_tutor" ? "sole_tutor" : "organization",
        },
      });
      break;
    case "digital_download":
      limit = tierInfo.digital_downloads_limit;
      currentCount = await DigitalDownloads.count({
        where: {
          owner_id: tutorId,
          owner_type: tutorType === "sole_tutor" ? "sole_tutor" : "organization",
        },
      });
      break;
    case "community":
      limit = tierInfo.communities_limit;
      const { Community } = await import("../../models/marketplace/index.js");
      currentCount = await Community.count({
        where: {
          tutor_id: tutorId,
          tutor_type: tutorType === "sole_tutor" ? "sole_tutor" : "organization",
        },
      });
      break;
    case "membership":
      limit = tierInfo.memberships_limit;
      const { Membership } = await import("../../models/marketplace/membership.js");
      currentCount = await Membership.count({
        where: {
          tutor_id: tutorId,
          tutor_type: tutorType === "sole_tutor" ? "sole_tutor" : "organization",
        },
      });
      break;
    default:
      return { allowed: true, reason: null };
  }

  if (limit === null) {
    // Unlimited
    return { allowed: true, reason: null };
  }

  if (currentCount >= limit) {
    return {
      allowed: false,
      reason: `You have reached your ${resourceType} limit (${limit}). Please upgrade your subscription.`,
    };
  }

  return { allowed: true, reason: null };
}

