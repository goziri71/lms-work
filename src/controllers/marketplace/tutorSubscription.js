import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TutorSubscription, SUBSCRIPTION_TIERS } from "../../models/marketplace/tutorSubscription.js";
import { Courses } from "../../models/course/courses.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
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

  // TODO: Handle payment for subscription (wallet or external payment)
  // For now, we'll just create/update the subscription

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
    end_date: tierInfo.price > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
    auto_renew: true,
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
    message: "Subscription updated successfully",
    data: subscription,
  });
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
 * Check if tutor can perform an action (e.g., create course)
 * Internal helper function
 */
export async function checkSubscriptionLimit(tutorId, tutorType, resourceType) {
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
    // TODO: Add communities and memberships when implemented
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

