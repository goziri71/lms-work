/**
 * Membership Access Service
 * Checks if a learner has access to a product via membership or ownership
 */

import { MembershipSubscription } from "../models/marketplace/membershipSubscription.js";
import { MembershipProduct } from "../models/marketplace/membershipProduct.js";
import { Membership } from "../models/marketplace/membership.js";
import { MembershipTierProduct } from "../models/marketplace/membershipTierProduct.js";
import { MembershipTier } from "../models/marketplace/membershipTier.js";
import { TutorSubscription } from "../models/marketplace/tutorSubscription.js";
import { CourseReg } from "../models/course_reg.js";
import { EBookPurchase } from "../models/marketplace/ebookPurchase.js";
import { DigitalDownloadPurchase } from "../models/marketplace/digitalDownloadPurchase.js";
import { CoachingSessionPurchase } from "../models/marketplace/coachingSessionPurchase.js";
import { CommunitySubscription } from "../models/marketplace/communitySubscription.js";
import { db } from "../database/database.js";

/**
 * Check if student has access to a product
 * @param {number} studentId - Student ID
 * @param {string} productType - Product type (course, ebook, digital_download, coaching_session, community)
 * @param {number} productId - Product ID
 * @returns {Object} Access information
 */
export async function checkProductAccess(studentId, productType, productId) {
  let isOwned = false;
  let hasMembershipAccess = false;
  let membershipInfo = null;

  // Check ownership
  switch (productType) {
    case "course":
      const courseReg = await CourseReg.findOne({
        where: {
          student_id: studentId,
          course_id: productId,
        },
      });
      isOwned = !!courseReg;
      break;

    case "ebook":
      const ebookPurchase = await EBookPurchase.findOne({
        where: {
          student_id: studentId,
          ebook_id: productId,
          status: "completed",
        },
      });
      isOwned = !!ebookPurchase;
      break;

    case "digital_download":
      const downloadPurchase = await DigitalDownloadPurchase.findOne({
        where: {
          student_id: studentId,
          digital_download_id: productId,
          status: "completed",
        },
      });
      isOwned = !!downloadPurchase;
      break;

    case "coaching_session":
      const sessionPurchase = await CoachingSessionPurchase.findOne({
        where: {
          student_id: studentId,
          session_id: productId,
          status: "completed",
        },
      });
      isOwned = !!sessionPurchase;
      break;

    case "community":
      const communitySub = await CommunitySubscription.findOne({
        where: {
          student_id: studentId,
          community_id: productId,
          status: "active",
        },
      });
      isOwned = !!communitySub;
      break;
  }

  // Check tier-based access first (new system)
  let tierProduct = await MembershipTierProduct.findOne({
    where: {
      product_type: productType,
      product_id: productId,
    },
    include: [
      {
        model: MembershipTier,
        as: "tier",
        include: [
          {
            model: Membership,
            as: "membership",
            where: {
              status: "active",
            },
          },
        ],
      },
    ],
  });

  // Verify tutor subscription is active for tier-based access
  if (tierProduct?.tier?.membership) {
    const tutorSubscription = await TutorSubscription.findOne({
      where: {
        tutor_id: tierProduct.tier.membership.tutor_id,
        tutor_type: tierProduct.tier.membership.tutor_type,
        status: "active",
      },
    });

    if (!tutorSubscription) {
      tierProduct = null;
    }
  }

  if (tierProduct && tierProduct.tier) {
    // Check if student has active subscription to this tier
    const subscription = await MembershipSubscription.findOne({
      where: {
        student_id: studentId,
        membership_id: tierProduct.tier.membership_id,
        tier_id: tierProduct.tier_id,
        status: "active",
      },
    });

    if (subscription) {
      // Check if subscription hasn't expired (for monthly/yearly)
      const now = new Date();
      let isActive = false;

      if (subscription.end_date) {
        const endDate = new Date(subscription.end_date);
        isActive = now <= endDate;
      } else {
        // Lifetime subscription
        isActive = true;
      }

      if (isActive) {
        // Determine pricing period from subscription
        let pricingPeriod = "monthly"; // default
        if (subscription.end_date) {
          const startDate = new Date(subscription.start_date);
          const endDate = new Date(subscription.end_date);
          const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
          pricingPeriod = daysDiff > 180 ? "yearly" : "monthly";
        } else {
          pricingPeriod = "lifetime";
        }

        // Get access level for this pricing period
        const accessLevelField = `${pricingPeriod}_access_level`;
        const accessLevel = tierProduct[accessLevelField];

        hasMembershipAccess = true;
        membershipInfo = {
          membership_id: tierProduct.tier.membership_id,
          membership_name: tierProduct.tier.membership?.name,
          tier_id: tierProduct.tier_id,
          tier_name: tierProduct.tier.tier_name,
          access_level: accessLevel,
          pricing_period: pricingPeriod,
        };
      }
    }
  }

  // Fallback: Check legacy membership access (non-tier system)
  if (!hasMembershipAccess) {
    let membershipProduct = await MembershipProduct.findOne({
      where: {
        product_type: productType,
        product_id: productId,
      },
      include: [
        {
          model: Membership,
          as: "membership",
          where: {
            status: "active",
          },
        },
      ],
    });

    // Verify tutor subscription is active
    if (membershipProduct?.membership) {
      const tutorSubscription = await TutorSubscription.findOne({
        where: {
          tutor_id: membershipProduct.membership.tutor_id,
          tutor_type: membershipProduct.membership.tutor_type,
          status: "active",
        },
      });

      // If tutor subscription is not active, membership is not accessible
      if (!tutorSubscription) {
        membershipProduct = null;
      }
    }

    if (membershipProduct) {
      // Check if student has active subscription to this membership
      const subscription = await MembershipSubscription.findOne({
        where: {
          student_id: studentId,
          membership_id: membershipProduct.membership_id,
          status: "active",
        },
      });

      if (subscription) {
        // Check if subscription hasn't expired (for monthly/yearly)
        if (subscription.end_date) {
          const now = new Date();
          const endDate = new Date(subscription.end_date);
          if (now <= endDate) {
            hasMembershipAccess = true;
            membershipInfo = {
              membership_id: membershipProduct.membership_id,
              membership_name: membershipProduct.membership?.name,
            };
          }
        } else {
          // Lifetime subscription
          hasMembershipAccess = true;
          membershipInfo = {
            membership_id: membershipProduct.membership_id,
            membership_name: membershipProduct.membership?.name,
          };
        }
      }
    }
  }

  // Determine access type
  let accessType = "none";
  let hasAccess = false;

  if (isOwned && hasMembershipAccess) {
    accessType = "both";
    hasAccess = true;
  } else if (isOwned) {
    accessType = "owned";
    hasAccess = true;
  } else if (hasMembershipAccess) {
    accessType = "membership";
    hasAccess = true;
  }

  return {
    has_access: hasAccess,
    access_type: accessType,
    is_owned: isOwned,
    has_membership_access: hasMembershipAccess,
    membership_id: membershipInfo?.membership_id || null,
    membership_name: membershipInfo?.membership_name || null,
  };
}
