/**
 * Membership Subscription Controller
 * Handles learner subscriptions to memberships
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Membership, MembershipProduct, MembershipSubscription, MembershipPayment } from "../../models/marketplace/index.js";
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
  const { payment_method = "wallet" } = req.body;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can subscribe to memberships", 403);
  }

  // Get membership
  const membership = await Membership.findOne({
    where: {
      id: membershipId,
      status: "active",
    },
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

  // Calculate dates based on pricing type
  const now = new Date();
  let endDate = null;
  let nextPaymentDate = null;

  if (membership.pricing_type === "monthly") {
    endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
    nextPaymentDate = new Date(endDate);
  } else if (membership.pricing_type === "yearly") {
    endDate = new Date(now);
    endDate.setFullYear(endDate.getFullYear() + 1);
    nextPaymentDate = new Date(endDate);
  } else if (membership.pricing_type === "lifetime") {
    endDate = null; // Lifetime has no end date
    nextPaymentDate = null;
  }
  // Free memberships don't need payment

  // Process payment if not free
  let payment = null;
  if (membership.pricing_type !== "free" && parseFloat(membership.price) > 0) {
    const price = parseFloat(membership.price);
    const currency = membership.currency || "NGN";

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
            payment_period: membership.pricing_type,
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
        payment_period: membership.pricing_type,
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
    status: "active",
    start_date: now,
    end_date: endDate,
    next_payment_date: nextPaymentDate,
    auto_renew: true,
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "Successfully subscribed to membership",
    data: {
      subscription,
      payment: payment,
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
