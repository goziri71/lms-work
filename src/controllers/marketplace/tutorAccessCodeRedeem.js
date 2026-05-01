import { Sequelize } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import {
  TutorSubscription,
  SUBSCRIPTION_TIERS,
} from "../../models/marketplace/tutorSubscription.js";
import { TutorAccessCode } from "../../models/marketplace/tutorAccessCode.js";
import { db } from "../../database/database.js";
import {
  hashAccessCode,
  normalizeAccessCodeInput,
} from "../../utils/tutorAccessCode.js";
import { checkSubscriptionExpiration } from "./tutorSubscription.js";

function getTutorInfo(req) {
  const userType = req.user.userType;
  let tutorId;
  let tutorType;

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
 * POST /api/marketplace/tutor/subscription/redeem-code
 * Body: { code: string }
 */
export const redeemTutorAccessCode = TryCatchFunction(async (req, res) => {
  const raw = req.body?.code;
  if (raw == null || String(raw).trim() === "") {
    throw new ErrorClass("code is required", 400);
  }

  const normalized = normalizeAccessCodeInput(raw);
  if (normalized.length < 8) {
    throw new ErrorClass("Invalid access code", 400);
  }

  const code_hash = hashAccessCode(normalized);
  const { tutorId, tutorType } = getTutorInfo(req);

  await checkSubscriptionExpiration(tutorId, tutorType);

  const existingActive = await TutorSubscription.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: "active",
    },
  });

  if (existingActive && existingActive.subscription_tier !== "free") {
    if (!existingActive.end_date) {
      throw new ErrorClass(
        "You already have an active paid subscription. Contact support if you need help.",
        400,
      );
    }
    const end = new Date(existingActive.end_date);
    if (end > new Date()) {
      throw new ErrorClass(
        "You already have an active paid subscription. Use it until it ends or contact support.",
        400,
      );
    }
  }

  const transaction = await db.transaction({
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  });

  try {
    const codeRow = await TutorAccessCode.findOne({
      where: { code_hash },
      transaction,
      lock: Sequelize.Transaction.LOCK.UPDATE,
    });

    if (!codeRow) {
      await transaction.rollback();
      throw new ErrorClass("Invalid access code", 400);
    }

    if (codeRow.status === "revoked") {
      await transaction.rollback();
      throw new ErrorClass("This access code has been revoked.", 400);
    }

    if (codeRow.status === "redeemed") {
      await transaction.rollback();
      throw new ErrorClass("This access code has already been used.", 400);
    }

    if (codeRow.valid_until) {
      const vu = new Date(codeRow.valid_until);
      if (new Date() > vu) {
        await transaction.rollback();
        throw new ErrorClass("This access code has expired.", 400);
      }
    }

    const tierInfo = SUBSCRIPTION_TIERS.grand_master;
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + (codeRow.duration_months || 3));

    const subscriptionData = {
      tutor_id: tutorId,
      tutor_type: tutorType,
      subscription_tier: "grand_master",
      status: "active",
      courses_limit: tierInfo.courses_limit,
      communities_limit: tierInfo.communities_limit,
      digital_downloads_limit: tierInfo.digital_downloads_limit,
      memberships_limit: tierInfo.memberships_limit,
      unlimited_coaching: tierInfo.unlimited_coaching,
      commission_rate: tierInfo.commission_rate,
      start_date: new Date(),
      end_date: endDate,
      auto_renew: false,
    };

    let subscription = await TutorSubscription.findOne({
      where: {
        tutor_id: tutorId,
        tutor_type: tutorType,
        status: "active",
      },
      transaction,
      lock: Sequelize.Transaction.LOCK.UPDATE,
    });

    if (subscription) {
      await subscription.update(subscriptionData, { transaction });
    } else {
      subscription = await TutorSubscription.create(subscriptionData, {
        transaction,
      });
    }

    await codeRow.update(
      {
        status: "redeemed",
        redeemed_at: new Date(),
        redeemed_tutor_id: tutorId,
        redeemed_tutor_type: tutorType,
      },
      { transaction },
    );

    await transaction.commit();

    res.json({
      success: true,
      message: `Full access (Grand Master) is active for ${codeRow.duration_months || 3} month(s).`,
      data: {
        subscription_id: subscription.id,
        subscription_tier: subscription.subscription_tier,
        end_date: subscription.end_date,
        access_code_id: codeRow.id,
      },
    });
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
});
