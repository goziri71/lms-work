import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { MarketplaceTransaction } from "../../models/marketplace/marketplaceTransaction.js";
import { Courses } from "../../models/course/courses.js";
import { Students } from "../../models/auth/student.js";
import { Op } from "sequelize";
import { getTutorRevenueStats } from "../../services/revenueSharingService.js";

/**
 * Get wallet balance and earnings summary
 * GET /api/marketplace/tutor/earnings/summary
 */
export const getEarningsSummary = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  // Get all-time stats
  const allTimeStats = await getTutorRevenueStats(ownerType, ownerId);

  // Get last 30 days stats
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const last30DaysStats = await getTutorRevenueStats(
    ownerType,
    ownerId,
    thirtyDaysAgo,
    new Date()
  );

  // Get last 7 days stats
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const last7DaysStats = await getTutorRevenueStats(
    ownerType,
    ownerId,
    sevenDaysAgo,
    new Date()
  );

  res.status(200).json({
    success: true,
    message: "Earnings summary retrieved successfully",
    data: {
      wallet: {
        balance: parseFloat(tutor.wallet_balance || 0),
        currency: "NGN", // Default, can be enhanced to support multiple currencies
      },
      earnings: {
        total_earnings: parseFloat(tutor.total_earnings || 0),
        total_payouts: parseFloat(tutor.total_payouts || 0),
        pending_payout: parseFloat(tutor.wallet_balance || 0),
      },
      revenue: {
        all_time: {
          total_revenue: allTimeStats.totalRevenue,
          total_earnings: allTimeStats.totalEarnings,
          transactions: allTimeStats.totalTransactions,
        },
        last_30_days: {
          total_revenue: last30DaysStats.totalRevenue,
          total_earnings: last30DaysStats.totalEarnings,
          transactions: last30DaysStats.totalTransactions,
        },
        last_7_days: {
          total_revenue: last7DaysStats.totalRevenue,
          total_earnings: last7DaysStats.totalEarnings,
          transactions: last7DaysStats.totalTransactions,
        },
      },
      commission_rate: parseFloat(tutor.commission_rate || 15),
    },
  });
});

/**
 * Get transaction history
 * GET /api/marketplace/tutor/earnings/transactions
 */
export const getTransactions = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const {
    page = 1,
    limit = 20,
    start_date,
    end_date,
    payment_status,
  } = req.query;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const where = {
    owner_type: ownerType,
    owner_id: ownerId,
  };

  if (payment_status) {
    where.payment_status = payment_status;
  }

  if (start_date || end_date) {
    where.created_at = {};
    if (start_date) {
      where.created_at[Op.gte] = new Date(start_date);
    }
    if (end_date) {
      where.created_at[Op.lte] = new Date(end_date);
    }
  }

  const offset = (page - 1) * limit;

  const { count, rows: transactions } = await MarketplaceTransaction.findAndCountAll({
    where,
    include: [
      {
        model: Courses,
        as: "course",
        attributes: ["id", "title", "course_code"],
      },
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "email", "matric_number"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit: parseInt(limit),
    offset,
  });

  const formattedTransactions = transactions.map((tx) => ({
    id: tx.id,
    course: {
      id: tx.course?.id,
      title: tx.course?.title,
      course_code: tx.course?.course_code,
    },
    student: tx.student
      ? {
          id: tx.student.id,
          name: `${tx.student.fname || ""} ${tx.student.lname || ""}`.trim(),
          email: tx.student.email,
          matric_number: tx.student.matric_number,
        }
      : null,
    course_price: parseFloat(tx.course_price || 0),
    tutor_earnings: parseFloat(tx.tutor_earnings || 0),
    wsp_commission: parseFloat(tx.wsp_commission || 0),
    commission_rate: parseFloat(tx.commission_rate || 0),
    currency: tx.currency,
    payment_status: tx.payment_status,
    payment_method: tx.payment_method,
    payment_reference: tx.payment_reference,
    tutor_paid: tx.tutor_paid,
    payout_date: tx.payout_date,
    created_at: tx.created_at,
  }));

  res.status(200).json({
    success: true,
    message: "Transactions retrieved successfully",
    data: {
      transactions: formattedTransactions,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    },
  });
});

/**
 * Get single transaction details
 * GET /api/marketplace/tutor/earnings/transactions/:id
 */
export const getTransactionById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const transaction = await MarketplaceTransaction.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
    },
    include: [
      {
        model: Courses,
        as: "course",
        attributes: ["id", "title", "course_code", "price"],
      },
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "mname", "lname", "email", "matric_number", "phone"],
      },
    ],
  });

  if (!transaction) {
    throw new ErrorClass("Transaction not found", 404);
  }

  const transactionData = {
    id: transaction.id,
    course: {
      id: transaction.course?.id,
      title: transaction.course?.title,
      course_code: transaction.course?.course_code,
      price: transaction.course?.price,
    },
    student: transaction.student
      ? {
          id: transaction.student.id,
          name: `${transaction.student.fname || ""} ${transaction.student.mname || ""} ${transaction.student.lname || ""}`.trim(),
          email: transaction.student.email,
          matric_number: transaction.student.matric_number,
          phone: transaction.student.phone,
        }
      : null,
    course_price: parseFloat(transaction.course_price || 0),
    tutor_earnings: parseFloat(transaction.tutor_earnings || 0),
    wsp_commission: parseFloat(transaction.wsp_commission || 0),
    commission_rate: parseFloat(transaction.commission_rate || 0),
    currency: transaction.currency,
    payment_status: transaction.payment_status,
    payment_method: transaction.payment_method,
    payment_reference: transaction.payment_reference,
    tutor_paid: transaction.tutor_paid,
    payout_date: transaction.payout_date,
    notes: transaction.notes,
    created_at: transaction.created_at,
    updated_at: transaction.updated_at,
  };

  res.status(200).json({
    success: true,
    message: "Transaction retrieved successfully",
    data: {
      transaction: transactionData,
    },
  });
});

