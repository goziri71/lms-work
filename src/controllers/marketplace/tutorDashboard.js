import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Courses } from "../../models/course/courses.js";
import { MarketplaceTransaction } from "../../models/marketplace/marketplaceTransaction.js";
import { CourseReg } from "../../models/course_reg.js";
import { Op } from "sequelize";
import { db } from "../../database/database.js";
import { getTutorRevenueStats } from "../../services/revenueSharingService.js";

/**
 * Get tutor dashboard overview
 * GET /api/marketplace/dashboard
 */
export const getDashboard = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  // Determine owner_type and owner_id
  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  // Get tutor course IDs first for enrollment count
  const tutorCourses = await Courses.findAll({
    where: {
      owner_type: ownerType,
      owner_id: ownerId,
      is_marketplace: true,
    },
    attributes: ["id"],
  });
  const courseIds = tutorCourses.map((c) => c.id);

  // Get course statistics
  const [
    totalCourses,
    publishedCourses,
    draftCourses,
    pendingCourses,
    totalEnrollments,
    totalRevenue,
    totalEarnings,
    recentTransactions,
  ] = await Promise.all([
    // Total courses
    Courses.count({
      where: {
        owner_type: ownerType,
        owner_id: ownerId,
        is_marketplace: true,
      },
    }),
    // Published courses
    Courses.count({
      where: {
        owner_type: ownerType,
        owner_id: ownerId,
        is_marketplace: true,
        marketplace_status: "published",
      },
    }),
    // Draft courses
    Courses.count({
      where: {
        owner_type: ownerType,
        owner_id: ownerId,
        is_marketplace: true,
        marketplace_status: "draft",
      },
    }),
    // Pending courses
    Courses.count({
      where: {
        owner_type: ownerType,
        owner_id: ownerId,
        is_marketplace: true,
        marketplace_status: "pending",
      },
    }),
    // Total enrollments (marketplace purchases)
    courseIds.length > 0
      ? CourseReg.count({
          where: {
            course_id: { [Op.in]: courseIds },
            registration_status: "marketplace_purchased",
            academic_year: null,
            semester: null,
          },
        })
      : 0,
    // Total revenue (sum of course_price from transactions)
    MarketplaceTransaction.sum("course_price", {
      where: {
        owner_type: ownerType,
        owner_id: ownerId,
        payment_status: "completed",
      },
    }),
    // Total earnings (sum of tutor_earnings from transactions)
    MarketplaceTransaction.sum("tutor_earnings", {
      where: {
        owner_type: ownerType,
        owner_id: ownerId,
        payment_status: "completed",
      },
    }),
    // Recent transactions (last 5)
    MarketplaceTransaction.findAll({
      where: {
        owner_type: ownerType,
        owner_id: ownerId,
        payment_status: "completed",
      },
      include: [
        {
          model: Courses,
          as: "course",
          attributes: ["id", "title", "course_code"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 5,
    }),
  ]);

  // Get revenue stats for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const revenueStats = await getTutorRevenueStats(
    ownerType,
    ownerId,
    thirtyDaysAgo,
    new Date()
  );

  // Get top selling courses
  const topCoursesData = await MarketplaceTransaction.findAll({
    where: {
      owner_type: ownerType,
      owner_id: ownerId,
      payment_status: "completed",
    },
    attributes: [
      "course_id",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("MarketplaceTransaction.id")), "purchase_count"],
      [db.Sequelize.fn("SUM", db.Sequelize.col("tutor_earnings")), "total_earnings"],
    ],
    include: [
      {
        model: Courses,
        as: "course",
        attributes: ["id", "title", "course_code", "price"],
        required: true,
      },
    ],
    group: ["course_id", "course.id", "course.title", "course.course_code", "course.price"],
    order: [[db.Sequelize.fn("COUNT", db.Sequelize.col("MarketplaceTransaction.id")), "DESC"]],
    limit: 5,
    raw: true,
    nest: true,
  });

  res.status(200).json({
    success: true,
    message: "Dashboard data retrieved successfully",
    data: {
      overview: {
        wallet_balance: parseFloat(tutor.wallet_balance || 0),
        total_earnings: parseFloat(tutor.total_earnings || 0),
        total_payouts: parseFloat(tutor.total_payouts || 0),
        rating: tutor.rating ? parseFloat(tutor.rating) : null,
        total_reviews: tutor.total_reviews || 0,
      },
      courses: {
        total: totalCourses,
        published: publishedCourses,
        draft: draftCourses,
        pending: pendingCourses,
      },
      enrollments: {
        total: totalEnrollments,
      },
      revenue: {
        total_revenue: parseFloat(totalRevenue || 0),
        total_earnings: parseFloat(totalEarnings || 0),
        last_30_days: {
          revenue: revenueStats.totalRevenue,
          earnings: revenueStats.totalEarnings,
          transactions: revenueStats.totalTransactions,
        },
      },
      top_courses: topCoursesData.map((item) => ({
        course_id: item.course_id,
        title: item.course?.title,
        course_code: item.course?.course_code,
        price: item.course?.price,
        purchase_count: parseInt(item.purchase_count || 0),
        total_earnings: parseFloat(item.total_earnings || 0),
      })),
      recent_transactions: recentTransactions.map((tx) => ({
        id: tx.id,
        course: {
          id: tx.course?.id,
          title: tx.course?.title,
          course_code: tx.course?.course_code,
        },
        course_price: parseFloat(tx.course_price || 0),
        tutor_earnings: parseFloat(tx.tutor_earnings || 0),
        currency: tx.currency,
        created_at: tx.created_at,
      })),
    },
  });
});

