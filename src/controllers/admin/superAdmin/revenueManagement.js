import { MarketplaceTransaction } from "../../../models/marketplace/marketplaceTransaction.js";
import { WspCommission } from "../../../models/marketplace/wspCommission.js";
import { Courses } from "../../../models/course/courses.js";
import { Students } from "../../../models/auth/student.js";
import { SoleTutor } from "../../../models/marketplace/soleTutor.js";
import { Organization } from "../../../models/marketplace/organization.js";
import {
  getWspRevenueStats,
  getTutorRevenueStats,
} from "../../../services/revenueSharingService.js";
import { db } from "../../../database/database.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";

/**
 * Get all marketplace transactions
 */
export const getAllMarketplaceTransactions = TryCatchFunction(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    owner_type,
    owner_id,
    payment_status,
    start_date,
    end_date,
  } = req.query;

  const where = {};
  if (owner_type) where.owner_type = owner_type;
  if (owner_id) where.owner_id = owner_id;
  if (payment_status) where.payment_status = payment_status;

  if (start_date || end_date) {
    where.created_at = {};
    if (start_date) where.created_at[db.Sequelize.Op.gte] = start_date;
    if (end_date) where.created_at[db.Sequelize.Op.lte] = end_date;
  }

  const offset = (page - 1) * limit;

  const { count, rows: transactions } =
    await MarketplaceTransaction.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
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
        {
          model: WspCommission,
          as: "wspCommission",
          attributes: ["id", "amount", "status", "collected_at"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

  res.status(200).json({
    success: true,
    message: "Marketplace transactions retrieved successfully",
    data: {
      transactions,
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
 * Get WSP revenue statistics
 */
export const getWspRevenueStatistics = TryCatchFunction(async (req, res) => {
  const { start_date, end_date } = req.query;

  const stats = await getWspRevenueStats(start_date, end_date);

  // Get top earning tutors
  const topTutors = await MarketplaceTransaction.findAll({
    attributes: [
      "owner_type",
      "owner_id",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "sales_count"],
      [db.Sequelize.fn("SUM", db.Sequelize.col("course_price")), "total_revenue"],
      [db.Sequelize.fn("SUM", db.Sequelize.col("wsp_commission")), "total_commission"],
    ],
    where: {
      payment_status: "completed",
      ...(start_date || end_date
        ? {
            created_at: {
              ...(start_date && { [db.Sequelize.Op.gte]: start_date }),
              ...(end_date && { [db.Sequelize.Op.lte]: end_date }),
            },
          }
        : {}),
    },
    group: ["owner_type", "owner_id"],
    order: [[db.Sequelize.literal("total_commission"), "DESC"]],
    limit: 10,
    raw: true,
  });

  // Get pending payouts (tutors who haven't been paid)
  const pendingPayouts = await MarketplaceTransaction.sum("tutor_earnings", {
    where: {
      payment_status: "completed",
      tutor_paid: false,
    },
  });

  res.status(200).json({
    success: true,
    message: "WSP revenue statistics retrieved successfully",
    data: {
      ...stats,
      pendingPayouts: pendingPayouts || 0,
      topEarners: topTutors,
    },
  });
});

/**
 * Get tutor revenue details
 */
export const getTutorRevenueDetails = TryCatchFunction(async (req, res) => {
  const { owner_type, owner_id } = req.params;
  const { start_date, end_date } = req.query;

  if (!["sole_tutor", "organization"].includes(owner_type)) {
    throw new ErrorClass("Invalid owner type", 400);
  }

  // Get owner
  let owner;
  if (owner_type === "sole_tutor") {
    owner = await SoleTutor.findByPk(owner_id);
  } else {
    owner = await Organization.findByPk(owner_id);
  }

  if (!owner) {
    throw new ErrorClass("Tutor/Organization not found", 404);
  }

  // Get revenue stats
  const stats = await getTutorRevenueStats(
    owner_type,
    owner_id,
    start_date,
    end_date
  );

  // Get transaction history
  const transactions = await MarketplaceTransaction.findAll({
    where: {
      owner_type,
      owner_id,
      payment_status: "completed",
      ...(start_date || end_date
        ? {
            created_at: {
              ...(start_date && { [db.Sequelize.Op.gte]: start_date }),
              ...(end_date && { [db.Sequelize.Op.lte]: end_date }),
            },
          }
        : {}),
    },
    include: [
      {
        model: Courses,
        as: "course",
        attributes: ["id", "title", "course_code"],
      },
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "email"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit: 50,
  });

  res.status(200).json({
    success: true,
    message: "Tutor revenue details retrieved successfully",
    data: {
      owner: {
        id: owner.id,
        name:
          owner_type === "sole_tutor"
            ? `${owner.fname} ${owner.lname}`
            : owner.name,
        email: owner.email,
        wallet_balance: owner.wallet_balance,
        total_earnings: owner.total_earnings,
        commission_rate: owner.commission_rate,
      },
      statistics: stats,
      recentTransactions: transactions,
    },
  });
});

