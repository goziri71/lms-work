import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CoachingHoursBalance } from "../../models/marketplace/coachingHoursBalance.js";
import { CoachingHoursPurchase } from "../../models/marketplace/coachingHoursPurchase.js";
import { CoachingSettings } from "../../models/marketplace/coachingSettings.js";
import { TutorSubscription, SUBSCRIPTION_TIERS } from "../../models/marketplace/tutorSubscription.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { TutorWalletTransaction } from "../../models/marketplace/tutorWalletTransaction.js";
import { db } from "../../database/database.js";
import { Sequelize } from "sequelize";

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
    tutorId = req.tutor.organization_id;
    tutorType = "organization";
  } else {
    throw new ErrorClass("Invalid user type", 403);
  }

  return { tutorId, tutorType };
}

/**
 * Get coaching hours balance
 * GET /api/marketplace/tutor/coaching/hours-balance
 */
export const getHoursBalance = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);

  // Check if tutor has unlimited coaching
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

  if (tierInfo.unlimited_coaching) {
    return res.json({
      success: true,
      data: {
        hours_balance: null, // null means unlimited
        unlimited: true,
        total_purchased: 0,
        total_used: 0,
      },
    });
  }

  // Get or create balance record
  let balance = await CoachingHoursBalance.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!balance) {
    balance = await CoachingHoursBalance.create({
      tutor_id: tutorId,
      tutor_type: tutorType,
      hours_balance: 0.0,
      total_purchased: 0.0,
      total_used: 0.0,
    });
  }

  res.json({
    success: true,
    data: {
      hours_balance: parseFloat(balance.hours_balance),
      unlimited: false,
      total_purchased: parseFloat(balance.total_purchased),
      total_used: parseFloat(balance.total_used),
      last_updated: balance.last_updated,
    },
  });
});

/**
 * Purchase coaching hours
 * POST /api/marketplace/tutor/coaching/purchase-hours
 * Body: { hours }
 */
export const purchaseHours = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { hours } = req.body;

  if (!hours || hours <= 0) {
    throw new ErrorClass("Hours must be a positive number", 400);
  }

  // Check if tutor has unlimited coaching
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

  if (tierInfo.unlimited_coaching) {
    throw new ErrorClass("You have unlimited coaching hours. No purchase needed.", 400);
  }

  // Get coaching settings (price per hour)
  const settings = await CoachingSettings.findOne();
  if (!settings) {
    throw new ErrorClass("Coaching settings not configured. Please contact admin.", 500);
  }

  const pricePerHour = parseFloat(settings.price_per_hour);
  const totalAmount = pricePerHour * hours;

  // Get tutor wallet balance
  let tutor;
  if (tutorType === "sole_tutor") {
    tutor = await SoleTutor.findByPk(tutorId);
  } else {
    tutor = await Organization.findByPk(tutorId);
  }

  if (!tutor) {
    throw new ErrorClass("Tutor not found", 404);
  }

  const walletBalance = parseFloat(tutor.wallet_balance || 0);

  if (walletBalance < totalAmount) {
    throw new ErrorClass(
      `Insufficient wallet balance. Required: ${totalAmount} ${settings.currency}, Available: ${walletBalance} ${settings.currency}`,
      400
    );
  }

  // Use transaction to ensure atomicity
  const transaction = await db.transaction();

  try {
    // Deduct from wallet
    const newBalance = walletBalance - totalAmount;
    await tutor.update({ wallet_balance: newBalance }, { transaction });

    // Get or create balance record
    let balance = await CoachingHoursBalance.findOne({
      where: {
        tutor_id: tutorId,
        tutor_type: tutorType,
      },
      transaction,
    });

    if (!balance) {
      balance = await CoachingHoursBalance.create(
        {
          tutor_id: tutorId,
          tutor_type: tutorType,
          hours_balance: 0.0,
          total_purchased: 0.0,
          total_used: 0.0,
        },
        { transaction }
      );
    }

    // Add hours to balance
    const newHoursBalance = parseFloat(balance.hours_balance) + hours;
    const newTotalPurchased = parseFloat(balance.total_purchased) + hours;

    await balance.update(
      {
        hours_balance: newHoursBalance,
        total_purchased: newTotalPurchased,
        last_updated: new Date(),
      },
      { transaction }
    );

    // Create purchase record
    const transactionRef = `COACHING-HOURS-${tutorId}-${Date.now()}`;
    const purchase = await CoachingHoursPurchase.create(
      {
        tutor_id: tutorId,
        tutor_type: tutorType,
        hours_purchased: hours,
        price_per_hour: pricePerHour,
        total_amount: totalAmount,
        transaction_ref: transactionRef,
        payment_method: "wallet",
        currency: settings.currency,
        status: "completed",
      },
      { transaction }
    );

    // Create wallet transaction record
    await TutorWalletTransaction.create(
      {
        tutor_id: tutorId,
        tutor_type: tutorType,
        transaction_type: "debit",
        amount: totalAmount,
        currency: settings.currency,
        service_name: "Coaching Hours Purchase",
        transaction_reference: transactionRef,
        balance_before: walletBalance,
        balance_after: newBalance,
        related_id: purchase.id,
        related_type: "coaching_hours",
        status: "successful",
      },
      { transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: "Coaching hours purchased successfully",
      data: {
        purchase_id: purchase.id,
        hours_purchased: hours,
        price_per_hour: pricePerHour,
        total_amount: totalAmount,
        new_hours_balance: newHoursBalance,
        new_wallet_balance: newBalance,
        transaction_ref: transactionRef,
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Get purchase history
 * GET /api/marketplace/tutor/coaching/purchase-history
 */
export const getPurchaseHistory = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { page = 1, limit = 20 } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: purchases } = await CoachingHoursPurchase.findAndCountAll({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
    order: [["purchased_at", "DESC"]],
    limit: parseInt(limit),
    offset,
  });

  res.json({
    success: true,
    data: {
      purchases: purchases.map((p) => ({
        id: p.id,
        hours_purchased: parseFloat(p.hours_purchased),
        price_per_hour: parseFloat(p.price_per_hour),
        total_amount: parseFloat(p.total_amount),
        currency: p.currency,
        transaction_ref: p.transaction_ref,
        status: p.status,
        purchased_at: p.purchased_at,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

/**
 * Internal helper to check and deduct hours
 */
export async function checkAndDeductHours(tutorId, tutorType, hours, transaction = null) {
  // Check if tutor has unlimited coaching
  const subscription = await TutorSubscription.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: "active",
    },
    transaction,
  });

  const tierInfo = subscription
    ? SUBSCRIPTION_TIERS[subscription.subscription_tier]
    : SUBSCRIPTION_TIERS.free;

  if (tierInfo.unlimited_coaching) {
    return { allowed: true, unlimited: true };
  }

  // Get balance
  let balance = await CoachingHoursBalance.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
    transaction,
  });

  if (!balance) {
    balance = await CoachingHoursBalance.create(
      {
        tutor_id: tutorId,
        tutor_type: tutorType,
        hours_balance: 0.0,
        total_purchased: 0.0,
        total_used: 0.0,
      },
      { transaction }
    );
  }

  const currentBalance = parseFloat(balance.hours_balance);

  if (currentBalance < hours) {
    return {
      allowed: false,
      unlimited: false,
      reason: `Insufficient coaching hours. Required: ${hours}, Available: ${currentBalance}. Please purchase more hours.`,
    };
  }

  // Deduct hours
  const newBalance = currentBalance - hours;
  const newTotalUsed = parseFloat(balance.total_used) + hours;

  await balance.update(
    {
      hours_balance: newBalance,
      total_used: newTotalUsed,
      last_updated: new Date(),
    },
    { transaction }
  );

  return {
    allowed: true,
    unlimited: false,
    newBalance,
  };
}

/**
 * Internal helper to refund hours (e.g., when session is cancelled)
 */
export async function refundHours(tutorId, tutorType, hours, transaction = null) {
  // Check if tutor has unlimited coaching
  const subscription = await TutorSubscription.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: "active",
    },
    transaction,
  });

  const tierInfo = subscription
    ? SUBSCRIPTION_TIERS[subscription.subscription_tier]
    : SUBSCRIPTION_TIERS.free;

  if (tierInfo.unlimited_coaching) {
    return; // No refund needed for unlimited
  }

  // Get balance
  let balance = await CoachingHoursBalance.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
    transaction,
  });

  if (!balance) {
    return; // No balance record, nothing to refund
  }

  // Add hours back
  const newBalance = parseFloat(balance.hours_balance) + hours;
  const newTotalUsed = Math.max(0, parseFloat(balance.total_used) - hours);

  await balance.update(
    {
      hours_balance: newBalance,
      total_used: newTotalUsed,
      last_updated: new Date(),
    },
    { transaction }
  );
}

