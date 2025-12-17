import { MarketplaceTransaction } from "../models/marketplace/marketplaceTransaction.js";
import { WspCommission } from "../models/marketplace/wspCommission.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";
import { Courses } from "../models/course/courses.js";
import { Students } from "../models/auth/student.js";
import { db } from "../database/database.js";

/**
 * Calculate commission and earnings
 * @param {number} coursePrice - Price of the course
 * @param {number} commissionRate - WPU commission percentage (e.g., 15 for 15%)
 * @returns {Object} - { wspCommission, tutorEarnings }
 */
export function calculateRevenue(coursePrice, commissionRate) {
  const price = parseFloat(coursePrice);
  const rate = parseFloat(commissionRate) / 100;

  const wspCommission = price * rate;
  const tutorEarnings = price - wspCommission;

  return {
    wspCommission: parseFloat(wspCommission.toFixed(2)),
    tutorEarnings: parseFloat(tutorEarnings.toFixed(2)),
  };
}

/**
 * Process marketplace course purchase and distribute revenue
 * 
 * Handles both:
 * - WPU marketplace courses: 100% revenue to WPU (no commission split)
 * - Regular marketplace courses (sole_tutor/organization): Commission split
 * 
 * @param {Object} purchaseData - Purchase information
 * @param {number} purchaseData.course_id - Course ID
 * @param {number} purchaseData.student_id - Student ID
 * @param {string} purchaseData.payment_reference - Payment gateway reference
 * @param {string} purchaseData.payment_method - Payment method
 * @returns {Promise<Object>} - Transaction record
 */
export async function processMarketplacePurchase(purchaseData) {
  const { course_id, student_id, payment_reference, payment_method } =
    purchaseData;

  // Validate and truncate payment_reference if too long (defensive measure)
  // Database column is VARCHAR(255), but truncate to 250 to be safe
  const safePaymentReference = payment_reference 
    ? (payment_reference.length > 250 ? payment_reference.substring(0, 250) : payment_reference)
    : null;
  
  // Validate and truncate payment_method if too long (defensive measure)
  // Database column is VARCHAR(50), but truncate to 45 to be safe
  const safePaymentMethod = payment_method 
    ? (payment_method.length > 45 ? payment_method.substring(0, 45) : payment_method)
    : "unknown";

  // Get course with owner information
  const course = await Courses.findByPk(course_id);
  if (!course) {
    throw new Error("Course not found");
  }

  // Check if course is on marketplace
  if (!course.is_marketplace || course.marketplace_status !== "published") {
    throw new Error("Course is not available on marketplace");
  }

  // Get course price
  const coursePrice = parseFloat(course.price || 0);
  if (coursePrice <= 0) {
    throw new Error("Course price is invalid");
  }

  // Handle WPU marketplace courses (100% revenue to WPU)
  if (course.owner_type === "wpu" || course.owner_type === "wsp") {
    // WPU marketplace course - 100% revenue to WPU, no commission split
    const transaction = await MarketplaceTransaction.create({
      course_id,
      student_id,
      owner_type: "wpu", // Use "wpu" for transaction record
      owner_id: null, // WPU courses don't have owner_id
      course_price: coursePrice,
      currency: course.currency || "NGN",
      commission_rate: 0, // No commission (100% to WPU)
      wsp_commission: coursePrice, // 100% to WPU
      tutor_earnings: 0, // No tutor earnings
      payment_status: "completed",
      payment_method: safePaymentMethod,
      payment_reference: safePaymentReference,
    });

    // Create WPU commission record (100% of course price)
    await WspCommission.create({
      transaction_id: transaction.id,
      amount: coursePrice,
      currency: course.currency || "NGN",
      status: "collected",
      collected_at: new Date(),
    });

    return {
      transaction,
      revenue: {
        coursePrice,
        wspCommission: coursePrice, // 100% to WPU
        tutorEarnings: 0, // No tutor earnings
        commissionRate: 0, // No commission
      },
    };
  }

  // Handle regular marketplace courses (sole_tutor/organization) - commission split
  // Get owner (tutor or organization)
  let owner;
  if (course.owner_type === "sole_tutor") {
    owner = await SoleTutor.findByPk(course.owner_id);
  } else if (course.owner_type === "organization") {
    owner = await Organization.findByPk(course.owner_id);
  }

  if (!owner) {
    throw new Error("Course owner not found");
  }

  // Calculate revenue split
  const commissionRate = parseFloat(owner.commission_rate || 15);
  const { wspCommission, tutorEarnings } = calculateRevenue(
    coursePrice,
    commissionRate
  );

  // Create transaction record
  const transaction = await MarketplaceTransaction.create({
    course_id,
    student_id,
    owner_type: course.owner_type,
    owner_id: course.owner_id,
    course_price: coursePrice,
    currency: course.currency || "NGN",
    commission_rate: commissionRate,
    wsp_commission: wspCommission,
    tutor_earnings: tutorEarnings,
    payment_status: "completed",
    payment_method: safePaymentMethod,
    payment_reference: safePaymentReference,
  });

  // Create WPU commission record
  await WspCommission.create({
    transaction_id: transaction.id,
    amount: wspCommission,
    currency: course.currency || "NGN",
    status: "collected", // Automatically collected when payment is successful
    collected_at: new Date(),
  });

  // Update owner's earnings and wallet
  const newTotalEarnings = parseFloat(owner.total_earnings || 0) + coursePrice;
  const newWalletBalance =
    parseFloat(owner.wallet_balance || 0) + tutorEarnings;

  await owner.update({
    total_earnings: newTotalEarnings,
    wallet_balance: newWalletBalance,
  });

  return {
    transaction,
    revenue: {
      coursePrice,
      wspCommission,
      tutorEarnings,
      commissionRate,
    },
  };
}

/**
 * Get revenue statistics for WPU
 */
export async function getWspRevenueStats(startDate, endDate) {
  const where = {};
  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at[db.Sequelize.Op.gte] = startDate;
    if (endDate) where.created_at[db.Sequelize.Op.lte] = endDate;
  }

  const totalCommission = await MarketplaceTransaction.sum("wsp_commission", {
    where: {
      ...where,
      payment_status: "completed",
    },
  });

  const totalTransactions = await MarketplaceTransaction.count({
    where: {
      ...where,
      payment_status: "completed",
    },
  });

  const totalRevenue = await MarketplaceTransaction.sum("course_price", {
    where: {
      ...where,
      payment_status: "completed",
    },
  });

  // By owner type
  const byOwnerType = await MarketplaceTransaction.findAll({
    attributes: [
      "owner_type",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
      [db.Sequelize.fn("SUM", db.Sequelize.col("course_price")), "total_revenue"],
      [db.Sequelize.fn("SUM", db.Sequelize.col("wsp_commission")), "total_commission"],
    ],
    where: {
      ...where,
      payment_status: "completed",
    },
    group: ["owner_type"],
    raw: true,
  });

  return {
    totalCommission: totalCommission || 0,
    totalRevenue: totalRevenue || 0,
    totalTransactions,
    byOwnerType,
  };
}

/**
 * Get tutor revenue statistics
 */
export async function getTutorRevenueStats(ownerType, ownerId, startDate, endDate) {
  const where = {
    owner_type: ownerType,
    owner_id: ownerId,
    payment_status: "completed",
  };

  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at[db.Sequelize.Op.gte] = startDate;
    if (endDate) where.created_at[db.Sequelize.Op.lte] = endDate;
  }

  const totalEarnings = await MarketplaceTransaction.sum("tutor_earnings", {
    where,
  });

  const totalRevenue = await MarketplaceTransaction.sum("course_price", {
    where,
  });

  const totalTransactions = await MarketplaceTransaction.count({ where });

  return {
    totalEarnings: totalEarnings || 0,
    totalRevenue: totalRevenue || 0,
    totalTransactions,
  };
}

