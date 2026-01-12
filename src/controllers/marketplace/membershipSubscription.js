/**
 * Membership Subscription Controller
 * Handles learner subscriptions to memberships
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Membership, MembershipProduct, MembershipSubscription, MembershipPayment, MembershipTier, MembershipTierChange } from "../../models/marketplace/index.js";
import { Students } from "../../models/auth/student.js";
import { Funding } from "../../models/payment/index.js";
import { getWalletBalance } from "../../services/walletBalanceService.js";
import { db } from "../../database/database.js";
import { Op } from "sequelize";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { EBooks } from "../../models/marketplace/ebooks.js";
import { EBookPurchase } from "../../models/marketplace/ebookPurchase.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { DigitalDownloadPurchase } from "../../models/marketplace/digitalDownloadPurchase.js";
import { CoachingSession } from "../../models/marketplace/coachingSession.js";
import { CoachingSessionPurchase } from "../../models/marketplace/coachingSessionPurchase.js";
import { Community } from "../../models/marketplace/community.js";
import { CommunitySubscription } from "../../models/marketplace/communitySubscription.js";
import { TutorSubscription } from "../../models/marketplace/tutorSubscription.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { checkProductAccess as checkAccess } from "../../services/membershipAccessService.js";

/**
 * Browse memberships
 * GET /api/marketplace/memberships
 */
export const browseMemberships = TryCatchFunction(async (req, res) => {
  const { page = 1, limit = 20, tutor_id, category, pricing_type, search } = req.query;
  const studentId = req.user?.id;

  const where = {
    status: "active", // Only show active memberships
  };

  // Filter by tutor
  if (tutor_id) {
    where.tutor_id = parseInt(tutor_id);
  }

  // Filter by category
  if (category) {
    where.category = category;
  }

  // Filter by pricing type
  if (pricing_type) {
    where.pricing_type = pricing_type;
  }

  // Search by name or description
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  // First, get all active tutor subscriptions
  const activeTutorSubscriptions = await TutorSubscription.findAll({
    where: {
      status: "active",
    },
    attributes: ["tutor_id", "tutor_type"],
  });

  // Create map of active tutors
  const activeTutors = new Set();
  activeTutorSubscriptions.forEach((sub) => {
    activeTutors.add(`${sub.tutor_id}-${sub.tutor_type}`);
  });

  // Filter memberships to only those from active tutors
  const tutorWhere = [];
  activeTutorSubscriptions.forEach((sub) => {
    tutorWhere.push({
      tutor_id: sub.tutor_id,
      tutor_type: sub.tutor_type,
    });
  });

  if (tutorWhere.length === 0) {
    // No active tutors, return empty
    return res.json({
      status: true,
      code: 200,
      message: "Memberships retrieved successfully",
      data: {
        memberships: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0,
        },
      },
    });
  }

  where[Op.or] = tutorWhere;

  // Get memberships
  const memberships = await Membership.findAll({
    where,
    include: [
      {
        model: MembershipProduct,
        as: "products",
        attributes: ["id", "product_type", "product_id"],
      },
    ],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    order: [["created_at", "DESC"]],
  });

  // Get total count
  const total = await Membership.count({ where });

  // Get tutor names and check if student is subscribed
  const membershipsWithDetails = await Promise.all(
    memberships.map(async (membership) => {
      // Get tutor name
      let tutorName = null;
      if (membership.tutor_type === "sole_tutor") {
        const tutor = await SoleTutor.findByPk(membership.tutor_id);
        tutorName = tutor?.name || null;
      } else if (membership.tutor_type === "organization") {
        const org = await Organization.findByPk(membership.tutor_id);
        tutorName = org?.name || null;
      }

      // Check if student is subscribed
      let isSubscribed = false;
      if (studentId) {
        const subscription = await MembershipSubscription.findOne({
          where: {
            membership_id: membership.id,
            student_id: studentId,
            status: "active",
          },
        });
        isSubscribed = !!subscription;
      }

      return {
        id: membership.id,
        tutor_id: membership.tutor_id,
        tutor_type: membership.tutor_type,
        tutor_name: tutorName,
        name: membership.name,
        description: membership.description,
        category: membership.category,
        image_url: membership.image_url,
        pricing_type: membership.pricing_type,
        price: membership.price,
        currency: membership.currency,
        status: membership.status,
        product_count: membership.products?.length || 0,
        is_subscribed: isSubscribed,
        created_at: membership.created_at,
      };
    })
  );

  res.json({
    status: true,
    code: 200,
    message: "Memberships retrieved successfully",
    data: {
      memberships: membershipsWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
});

/**
 * Get membership details
 * GET /api/marketplace/memberships/:id
 */
export const getMembershipDetails = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const studentId = req.user?.id;

  const membership = await Membership.findOne({
    where: {
      id,
      status: "active",
    },
    include: [
      {
        model: MembershipProduct,
        as: "products",
      },
      {
        model: MembershipTier,
        as: "tiers",
        where: { status: "active" },
        required: false,
        include: [
          {
            model: MembershipTierProduct,
            as: "products",
          },
        ],
        order: [["display_order", "ASC"]],
      },
    ],
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  // Check tutor subscription is active
  const tutorSubscription = await TutorSubscription.findOne({
    where: {
      tutor_id: membership.tutor_id,
      tutor_type: membership.tutor_type,
      status: "active",
    },
  });

  if (!tutorSubscription) {
    throw new ErrorClass("This membership is currently unavailable", 403);
  }

  // Get tutor name
  let tutorName = null;
  if (membership.tutor_type === "sole_tutor") {
    const tutor = await SoleTutor.findByPk(membership.tutor_id);
    tutorName = tutor?.name || null;
  } else if (membership.tutor_type === "organization") {
    const org = await Organization.findByPk(membership.tutor_id);
    tutorName = org?.name || null;
  }

  // Get product details and check ownership
  const productsWithDetails = await Promise.all(
    membership.products.map(async (product) => {
      let productDetails = null;
      let isOwned = false;

      switch (product.product_type) {
        case "course":
          const course = await Courses.findByPk(product.product_id);
          if (course) {
            productDetails = {
              id: course.id,
              title: course.title,
              image_url: course.image_url,
              price: course.price,
            };
            if (studentId) {
              const registration = await CourseReg.findOne({
                where: {
                  student_id: studentId,
                  course_id: course.id,
                },
              });
              isOwned = !!registration;
            }
          }
          break;
        case "ebook":
          const ebook = await EBooks.findByPk(product.product_id);
          if (ebook) {
            productDetails = {
              id: ebook.id,
              title: ebook.title,
              cover_image: ebook.cover_image,
              price: ebook.price,
            };
            if (studentId) {
              const purchase = await EBookPurchase.findOne({
                where: {
                  student_id: studentId,
                  ebook_id: ebook.id,
                  status: "completed",
                },
              });
              isOwned = !!purchase;
            }
          }
          break;
        case "digital_download":
          const download = await DigitalDownloads.findByPk(product.product_id);
          if (download) {
            productDetails = {
              id: download.id,
              title: download.title,
              image_url: download.image_url,
              price: download.price,
            };
            if (studentId) {
              const purchase = await DigitalDownloadPurchase.findOne({
                where: {
                  student_id: studentId,
                  digital_download_id: download.id,
                  status: "completed",
                },
              });
              isOwned = !!purchase;
            }
          }
          break;
        case "coaching_session":
          const session = await CoachingSession.findByPk(product.product_id);
          if (session) {
            productDetails = {
              id: session.id,
              title: session.title,
              image_url: session.image_url,
              price: session.price,
            };
            if (studentId) {
              const purchase = await CoachingSessionPurchase.findOne({
                where: {
                  student_id: studentId,
                  session_id: session.id,
                  status: "completed",
                },
              });
              isOwned = !!purchase;
            }
          }
          break;
        case "community":
          const community = await Community.findByPk(product.product_id);
          if (community) {
            productDetails = {
              id: community.id,
              name: community.name,
              image_url: community.image_url,
              price: community.price,
            };
            if (studentId) {
              const subscription = await CommunitySubscription.findOne({
                where: {
                  student_id: studentId,
                  community_id: community.id,
                  status: "active",
                },
              });
              isOwned = !!subscription;
            }
          }
          break;
      }

      return {
        id: product.id,
        product_type: product.product_type,
        product_id: product.product_id,
        product_details: productDetails,
        is_owned: isOwned,
      };
    })
  );

  // Check if student is subscribed
  let subscription = null;
  let isSubscribed = false;
  if (studentId) {
    subscription = await MembershipSubscription.findOne({
      where: {
        membership_id: id,
        student_id: studentId,
      },
      order: [["created_at", "DESC"]],
    });
    isSubscribed = subscription?.status === "active";
  }

  res.json({
    status: true,
    code: 200,
    message: "Membership retrieved successfully",
    data: {
      membership: {
        id: membership.id,
        tutor_id: membership.tutor_id,
        tutor_type: membership.tutor_type,
        tutor_name: tutorName,
        name: membership.name,
        description: membership.description,
        category: membership.category,
        image_url: membership.image_url,
        pricing_type: membership.pricing_type,
        price: membership.price,
        currency: membership.currency,
        status: membership.status,
        products: productsWithDetails,
        is_subscribed: isSubscribed,
        subscription: subscription,
        created_at: membership.created_at,
      },
    },
  });
});

/**
 * Subscribe to membership
 * POST /api/marketplace/memberships/:id/subscribe
 */
export const subscribeToMembership = TryCatchFunction(async (req, res) => {
  const { id: membershipId } = req.params;
  const studentId = req.user?.id;
  const { payment_method = "wallet", tier_id, pricing_type } = req.body;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can subscribe to memberships", 403);
  }

  // Get membership with tiers
  const membership = await Membership.findOne({
    where: {
      id: membershipId,
      status: "active",
    },
    include: [
      {
        model: MembershipTier,
        as: "tiers",
        where: { status: "active" },
        required: false,
      },
    ],
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  // Determine if using tier system or legacy
  const hasTiers = membership.tiers && membership.tiers.length > 0;
  const useTierSystem = hasTiers;

  // If membership has tiers, tier_id and pricing_type are required
  if (useTierSystem) {
    if (!tier_id) {
      throw new ErrorClass("tier_id is required for this membership", 400);
    }
    if (!pricing_type || !["monthly", "yearly", "lifetime"].includes(pricing_type)) {
      throw new ErrorClass("pricing_type must be one of: monthly, yearly, lifetime", 400);
    }

    // Find and validate tier
    const tier = membership.tiers.find((t) => t.id === parseInt(tier_id));
    if (!tier) {
      throw new ErrorClass("Tier not found or inactive", 404);
    }

    // Check if tier has pricing for the selected period
    const priceField = `${pricing_type}_price`;
    const price = tier[priceField];
    if (price === null || price === undefined) {
      throw new ErrorClass(`This tier does not support ${pricing_type} pricing`, 400);
    }
  } else {
    // Legacy: use membership pricing
    if (!membership.pricing_type) {
      throw new ErrorClass("Membership pricing is not configured", 400);
    }
  }

  // Check tutor subscription is active
  const tutorSubscription = await TutorSubscription.findOne({
    where: {
      tutor_id: membership.tutor_id,
      tutor_type: membership.tutor_type,
      status: "active",
    },
  });

  if (!tutorSubscription) {
    throw new ErrorClass("This membership is currently unavailable. The tutor's subscription has expired.", 403);
  }

  // Check if already subscribed
  const existingSubscription = await MembershipSubscription.findOne({
    where: {
      membership_id: membershipId,
      student_id: studentId,
      status: "active",
    },
  });

  if (existingSubscription) {
    throw new ErrorClass("You are already subscribed to this membership", 400);
  }

  // Get student
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get pricing information
  let price = 0;
  let currency = "NGN";
  let selectedPricingType = null;
  let selectedTier = null;

  if (useTierSystem) {
    selectedTier = membership.tiers.find((t) => t.id === parseInt(tier_id));
    selectedPricingType = pricing_type;
    const priceField = `${pricing_type}_price`;
    price = parseFloat(selectedTier[priceField]);
    currency = selectedTier.currency || "NGN";
  } else {
    // Legacy
    selectedPricingType = membership.pricing_type;
    price = parseFloat(membership.price) || 0;
    currency = membership.currency || "NGN";
  }

  // Calculate dates based on pricing type
  const now = new Date();
  let endDate = null;
  let nextPaymentDate = null;

  if (selectedPricingType === "monthly") {
    endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
    nextPaymentDate = new Date(endDate);
  } else if (selectedPricingType === "yearly") {
    endDate = new Date(now);
    endDate.setFullYear(endDate.getFullYear() + 1);
    nextPaymentDate = new Date(endDate);
  } else if (selectedPricingType === "lifetime") {
    endDate = null; // Lifetime has no end date
    nextPaymentDate = null;
  }
  // Free memberships don't need payment

  // Process payment if not free
  let payment = null;
  if (selectedPricingType !== "free" && price > 0) {

    if (payment_method === "wallet") {
      // Get wallet balance
      const { balance: walletBalance } = await getWalletBalance(studentId, true);

      if (walletBalance < price) {
        throw new ErrorClass(
          `Insufficient wallet balance. Required: ${price} ${currency}, Available: ${walletBalance} ${currency}`,
          400
        );
      }

      // Use transaction for atomicity
      const transaction = await db.transaction();

      try {
        // Debit wallet
        const newBalance = walletBalance - price;
        const txRef = `MEMBERSHIP-SUB-${membershipId}-${Date.now()}`;

        await Funding.create(
          {
            student_id: studentId,
            amount: price,
            type: "Debit",
            service_name: "Membership Subscription",
            ref: txRef,
            date: now,
            semester: null,
            academic_year: null,
            currency: currency,
            balance: newBalance.toString(),
          },
          { transaction }
        );

        // Update student wallet
        await student.update({ wallet_balance: newBalance }, { transaction });

        // Create payment record
        payment = await MembershipPayment.create(
          {
            student_id: studentId,
            membership_id: membershipId,
            amount: price,
            currency: currency,
            payment_method: "wallet",
            payment_reference: txRef,
            status: "completed",
            payment_period: selectedPricingType,
            paid_at: now,
          },
          { transaction }
        );

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } else if (payment_method === "flutterwave") {
      // TODO: Implement Flutterwave payment
      // For now, create pending payment
      payment = await MembershipPayment.create({
        student_id: studentId,
        membership_id: membershipId,
        amount: price,
        currency: currency,
        payment_method: "flutterwave",
        status: "pending",
        payment_period: selectedPricingType,
      });

      // Return payment URL for Flutterwave
      // This would need to be implemented with Flutterwave integration
      throw new ErrorClass("Flutterwave payment not yet implemented", 501);
    }
  }

  // Create subscription
  const subscription = await MembershipSubscription.create({
    student_id: studentId,
    membership_id: membershipId,
    tier_id: useTierSystem ? parseInt(tier_id) : null,
    tier_name: useTierSystem ? selectedTier.tier_name : null,
    status: "active",
    start_date: now,
    end_date: endDate,
    next_payment_date: nextPaymentDate,
    auto_renew: true,
  });

  // Create tier change record for initial subscription
  if (useTierSystem) {
    await MembershipTierChange.create({
      subscription_id: subscription.id,
      old_tier_id: null,
      old_tier_name: null,
      new_tier_id: parseInt(tier_id),
      new_tier_name: selectedTier.tier_name,
      change_type: "initial",
      payment_amount: price > 0 ? price : null,
      refund_amount: null,
      currency: currency,
      effective_date: now,
    });
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: "Successfully subscribed to membership",
    data: {
      subscription,
      payment: payment,
      tier: useTierSystem ? {
        id: selectedTier.id,
        name: selectedTier.tier_name,
        pricing_type: selectedPricingType,
      } : null,
    },
  });
});

/**
 * Cancel subscription
 * POST /api/marketplace/memberships/:id/cancel
 */
export const cancelSubscription = TryCatchFunction(async (req, res) => {
  const { id: membershipId } = req.params;
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can cancel subscriptions", 403);
  }

  const subscription = await MembershipSubscription.findOne({
    where: {
      membership_id: membershipId,
      student_id: studentId,
      status: "active",
    },
  });

  if (!subscription) {
    throw new ErrorClass("Active subscription not found", 404);
  }

  // Cancel subscription (don't delete, just mark as cancelled)
  subscription.status = "cancelled";
  subscription.auto_renew = false;
  subscription.cancelled_at = new Date();
  await subscription.save();

  res.json({
    status: true,
    code: 200,
    message: "Subscription cancelled successfully",
    data: {
      subscription,
    },
  });
});

/**
 * Get my subscriptions
 * GET /api/marketplace/memberships/my-subscriptions
 */
export const getMySubscriptions = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  const { status, page = 1, limit = 20 } = req.query;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can view subscriptions", 403);
  }

  const where = {
    student_id: studentId,
  };

  if (status) {
    where.status = status;
  }

  const subscriptions = await MembershipSubscription.findAll({
    where,
    include: [
      {
        model: Membership,
        as: "membership",
        attributes: ["id", "name", "image_url", "pricing_type", "price", "currency"],
      },
    ],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    order: [["created_at", "DESC"]],
  });

  const total = await MembershipSubscription.count({ where });

  const subscriptionsWithDetails = subscriptions.map((sub) => ({
    id: sub.id,
    membership_id: sub.membership_id,
    membership_name: sub.membership?.name,
    membership_image: sub.membership?.image_url,
    pricing_type: sub.membership?.pricing_type,
    price: sub.membership?.price,
    currency: sub.membership?.currency,
    status: sub.status,
    start_date: sub.start_date,
    end_date: sub.end_date,
    next_payment_date: sub.next_payment_date,
    auto_renew: sub.auto_renew,
    cancelled_at: sub.cancelled_at,
    created_at: sub.created_at,
  }));

  res.json({
    status: true,
    code: 200,
    message: "Subscriptions retrieved successfully",
    data: {
      subscriptions: subscriptionsWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
});

/**
 * Change tier (upgrade/downgrade)
 * POST /api/marketplace/memberships/:id/change-tier
 */
export const changeTier = TryCatchFunction(async (req, res) => {
  const { id: membershipId } = req.params;
  const studentId = req.user?.id;
  const { new_tier_id, pricing_type, payment_method = "wallet" } = req.body;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can change tiers", 403);
  }

  if (!new_tier_id) {
    throw new ErrorClass("new_tier_id is required", 400);
  }

  if (!pricing_type || !["monthly", "yearly", "lifetime"].includes(pricing_type)) {
    throw new ErrorClass("pricing_type must be one of: monthly, yearly, lifetime", 400);
  }

  // Get membership with tiers
  const membership = await Membership.findOne({
    where: {
      id: membershipId,
      status: "active",
    },
    include: [
      {
        model: MembershipTier,
        as: "tiers",
        where: { status: "active" },
        required: false,
      },
    ],
  });

  if (!membership) {
    throw new ErrorClass("Membership not found", 404);
  }

  // Check if membership uses tier system
  const hasTiers = membership.tiers && membership.tiers.length > 0;
  if (!hasTiers) {
    throw new ErrorClass("This membership does not use the tier system", 400);
  }

  // Find new tier
  const newTier = membership.tiers.find((t) => t.id === parseInt(new_tier_id));
  if (!newTier) {
    throw new ErrorClass("New tier not found or inactive", 404);
  }

  // Check if new tier has pricing for selected period
  const newPriceField = `${pricing_type}_price`;
  const newPrice = newTier[newPriceField];
  if (newPrice === null || newPrice === undefined) {
    throw new ErrorClass(`This tier does not support ${pricing_type} pricing`, 400);
  }

  // Get current subscription
  const subscription = await MembershipSubscription.findOne({
    where: {
      membership_id: membershipId,
      student_id: studentId,
      status: "active",
    },
  });

  if (!subscription) {
    throw new ErrorClass("Active subscription not found", 404);
  }

  if (!subscription.tier_id) {
    throw new ErrorClass("Current subscription does not have a tier. Please subscribe to a tier first.", 400);
  }

  // Check if already on this tier
  if (subscription.tier_id === parseInt(new_tier_id)) {
    throw new ErrorClass("You are already subscribed to this tier", 400);
  }

  // Find old tier
  const oldTier = membership.tiers.find((t) => t.id === subscription.tier_id);
  if (!oldTier) {
    throw new ErrorClass("Current tier not found", 404);
  }

  // Get old tier price for current pricing period
  const oldPricingType = subscription.next_payment_date ? (subscription.end_date ? "yearly" : "monthly") : "lifetime";
  const oldPriceField = `${oldPricingType}_price`;
  const oldPrice = oldTier[oldPriceField] || 0;

  // Determine change type
  const isUpgrade = parseFloat(newPrice) > parseFloat(oldPrice);
  const changeType = isUpgrade ? "upgrade" : "downgrade";

  // Calculate payment/refund
  const now = new Date();
  let paymentAmount = 0;
  let refundAmount = 0;
  const currency = newTier.currency || "NGN";

  if (isUpgrade) {
    // Upgrade: Pay full new tier price
    paymentAmount = parseFloat(newPrice);
  } else {
    // Downgrade: Calculate prorated refund
    if (subscription.end_date) {
      const startDate = new Date(subscription.start_date);
      const endDate = new Date(subscription.end_date);
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const remainingDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      
      if (remainingDays > 0 && totalDays > 0) {
        const proratedOldPrice = (parseFloat(oldPrice) * remainingDays) / totalDays;
        refundAmount = proratedOldPrice;
      }
    } else {
      // Lifetime subscription - no refund for downgrade
      refundAmount = 0;
    }
  }

  // Get student
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Process payment/refund
  let payment = null;
  const transaction = await db.transaction();

  try {
    if (isUpgrade && paymentAmount > 0) {
      // Process upgrade payment
      if (payment_method === "wallet") {
        const { balance: walletBalance } = await getWalletBalance(studentId, true);

        if (walletBalance < paymentAmount) {
          await transaction.rollback();
          throw new ErrorClass(
            `Insufficient wallet balance. Required: ${paymentAmount} ${currency}, Available: ${walletBalance} ${currency}`,
            400
          );
        }

        // Debit wallet
        const newBalance = walletBalance - paymentAmount;
        const txRef = `MEMBERSHIP-TIER-UP-${membershipId}-${Date.now()}`;

        await Funding.create(
          {
            student_id: studentId,
            amount: paymentAmount,
            type: "Debit",
            service_name: "Membership Tier Upgrade",
            ref: txRef,
            date: now,
            semester: null,
            academic_year: null,
            currency: currency,
            balance: newBalance.toString(),
          },
          { transaction }
        );

        await student.update({ wallet_balance: newBalance }, { transaction });

        // Create payment record
        payment = await MembershipPayment.create(
          {
            student_id: studentId,
            membership_id: membershipId,
            amount: paymentAmount,
            currency: currency,
            payment_method: "wallet",
            payment_reference: txRef,
            status: "completed",
            payment_period: pricing_type,
            paid_at: now,
          },
          { transaction }
        );
      } else if (payment_method === "flutterwave") {
        // TODO: Implement Flutterwave payment
        await transaction.rollback();
        throw new ErrorClass("Flutterwave payment not yet implemented", 501);
      }
    } else if (!isUpgrade && refundAmount > 0) {
      // Process downgrade refund
      const newBalance = parseFloat(student.wallet_balance) + refundAmount;
      const txRef = `MEMBERSHIP-TIER-DOWN-${membershipId}-${Date.now()}`;

      await Funding.create(
        {
          student_id: studentId,
          amount: refundAmount,
          type: "Credit",
          service_name: "Membership Tier Downgrade Refund",
          ref: txRef,
          date: now,
          semester: null,
          academic_year: null,
          currency: currency,
          balance: newBalance.toString(),
        },
        { transaction }
      );

      await student.update({ wallet_balance: newBalance }, { transaction });
    }

    // Update subscription tier (immediate effect)
    subscription.tier_id = parseInt(new_tier_id);
    subscription.tier_name = newTier.tier_name;

    // Recalculate dates if pricing period changed
    if (pricing_type !== oldPricingType) {
      if (pricing_type === "monthly") {
        subscription.end_date = new Date(now);
        subscription.end_date.setMonth(subscription.end_date.getMonth() + 1);
        subscription.next_payment_date = new Date(subscription.end_date);
      } else if (pricing_type === "yearly") {
        subscription.end_date = new Date(now);
        subscription.end_date.setFullYear(subscription.end_date.getFullYear() + 1);
        subscription.next_payment_date = new Date(subscription.end_date);
      } else if (pricing_type === "lifetime") {
        subscription.end_date = null;
        subscription.next_payment_date = null;
      }
    }

    await subscription.save({ transaction });

    // Create tier change record
    const tierChange = await MembershipTierChange.create(
      {
        subscription_id: subscription.id,
        old_tier_id: oldTier.id,
        old_tier_name: oldTier.tier_name,
        new_tier_id: newTier.id,
        new_tier_name: newTier.tier_name,
        change_type: changeType,
        payment_amount: isUpgrade ? paymentAmount : null,
        refund_amount: !isUpgrade ? refundAmount : null,
        currency: currency,
        effective_date: now,
      },
      { transaction }
    );

    await transaction.commit();

    res.json({
      status: true,
      code: 200,
      message: `Tier ${changeType} successful`,
      data: {
        subscription,
        tier_change: tierChange,
        payment: payment,
        refund_amount: !isUpgrade ? refundAmount : null,
        new_tier: {
          id: newTier.id,
          name: newTier.tier_name,
          pricing_type: pricing_type,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Check product access
 * GET /api/marketplace/products/:productType/:productId/access
 */
export const checkProductAccessEndpoint = TryCatchFunction(async (req, res) => {
  const { productType, productId } = req.params;
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can check product access", 403);
  }

  const validProductTypes = ["course", "ebook", "digital_download", "coaching_session", "community"];
  if (!validProductTypes.includes(productType)) {
    throw new ErrorClass(`Invalid product type. Must be one of: ${validProductTypes.join(", ")}`, 400);
  }

  const accessInfo = await checkAccess(studentId, productType, parseInt(productId));

  res.json({
    status: true,
    code: 200,
    message: "Access information retrieved",
    data: accessInfo,
  });
});
