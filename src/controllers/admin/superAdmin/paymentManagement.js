import { Funding } from "../../../models/payment/funding.js";
import { SchoolFees } from "../../../models/payment/schoolFees.js";
import { CourseOrder } from "../../../models/payment/courseOrder.js";
import { Students } from "../../../models/auth/student.js";
import { db } from "../../../database/database.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";

/**
 * Get all funding transactions
 */
export const getAllFundings = TryCatchFunction(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    student_id,
    type,
    semester,
    academic_year,
    currency,
    start_date,
    end_date,
  } = req.query;

  const where = {};
  if (student_id) where.student_id = student_id;
  if (type) where.type = type;
  if (semester) where.semester = semester;
  if (academic_year) where.academic_year = academic_year;
  if (currency) where.currency = currency;

  // Date filtering (if dates are provided)
  if (start_date || end_date) {
    where.date = {};
    if (start_date) where.date[db.Sequelize.Op.gte] = start_date;
    if (end_date) where.date[db.Sequelize.Op.lte] = end_date;
  }

  const offset = (page - 1) * limit;

  const { count, rows: fundings } = await Funding.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "email", "matric_number"],
        required: false,
      },
    ],
    order: [["id", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Funding transactions retrieved successfully",
    data: {
      fundings,
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
 * Get funding statistics
 */
export const getFundingStats = TryCatchFunction(async (req, res) => {
  const totalFundings = await Funding.count();
  const totalCredits = await Funding.sum("amount", {
    where: { type: "Credit" },
  });
  const totalDebits = await Funding.sum("amount", {
    where: { type: "Debit" },
  });

  // By type
  const byType = await Funding.findAll({
    attributes: [
      "type",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
      [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "total"],
    ],
    group: ["type"],
    raw: true,
  });

  // By currency
  const byCurrency = await Funding.findAll({
    attributes: [
      "currency",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
      [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "total"],
    ],
    group: ["currency"],
    raw: true,
  });

  res.status(200).json({
    success: true,
    message: "Funding statistics retrieved successfully",
    data: {
      total: totalFundings,
      totalCredits: totalCredits || 0,
      totalDebits: totalDebits || 0,
      netBalance: (totalCredits || 0) - (totalDebits || 0),
      byType,
      byCurrency,
    },
  });
});

/**
 * Get all school fees
 */
export const getAllSchoolFees = TryCatchFunction(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    student_id,
    status,
    semester,
    academic_year,
    start_date,
    end_date,
  } = req.query;

  const where = {};
  if (student_id) where.student_id = student_id;
  if (status) where.status = status;
  if (semester) where.semester = semester;
  if (academic_year) where.academic_year = academic_year;

  if (start_date || end_date) {
    where.date = {};
    if (start_date) where.date[db.Sequelize.Op.gte] = start_date;
    if (end_date) where.date[db.Sequelize.Op.lte] = end_date;
  }

  const offset = (page - 1) * limit;

  const { count, rows: schoolFees } = await SchoolFees.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "email", "matric_number"],
        required: false,
      },
    ],
    order: [["id", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "School fees retrieved successfully",
    data: {
      schoolFees,
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
 * Get school fees statistics
 */
export const getSchoolFeesStats = TryCatchFunction(async (req, res) => {
  const totalFees = await SchoolFees.count();
  const totalAmount = await SchoolFees.sum("amount");
  const paidAmount = await SchoolFees.sum("amount", {
    where: { status: "Paid" },
  });
  const pendingAmount = await SchoolFees.sum("amount", {
    where: { status: { [db.Sequelize.Op.ne]: "Paid" } },
  });

  // By status
  const byStatus = await SchoolFees.findAll({
    attributes: [
      "status",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
      [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "total"],
    ],
    group: ["status"],
    raw: true,
  });

  // By semester
  const bySemester = await SchoolFees.findAll({
    attributes: [
      "semester",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
      [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "total"],
    ],
    group: ["semester"],
    raw: true,
  });

  res.status(200).json({
    success: true,
    message: "School fees statistics retrieved successfully",
    data: {
      total: totalFees,
      totalAmount: totalAmount || 0,
      paidAmount: paidAmount || 0,
      pendingAmount: pendingAmount || 0,
      byStatus,
      bySemester,
    },
  });
});

/**
 * Get all course orders
 */
export const getAllCourseOrders = TryCatchFunction(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    student_id,
    semester,
    academic_year,
    level,
    start_date,
    end_date,
  } = req.query;

  const where = {};
  if (student_id) where.student_id = student_id;
  if (semester) where.semester = semester;
  if (academic_year) where.academic_year = academic_year;
  if (level) where.level = level;

  if (start_date || end_date) {
    where.date = {};
    if (start_date) where.date[db.Sequelize.Op.gte] = start_date;
    if (end_date) where.date[db.Sequelize.Op.lte] = end_date;
  }

  const offset = (page - 1) * limit;

  const { count, rows: courseOrders } = await CourseOrder.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "email", "matric_number"],
        required: false,
      },
    ],
    order: [["id", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Course orders retrieved successfully",
    data: {
      courseOrders,
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
 * Get course orders statistics
 */
export const getCourseOrderStats = TryCatchFunction(async (req, res) => {
  const totalOrders = await CourseOrder.count();
  
  // Sum amount by casting to INTEGER (amount is stored as VARCHAR)
  const totalAmountResult = await CourseOrder.findAll({
    attributes: [
      [
        db.Sequelize.fn(
          "SUM",
          db.Sequelize.cast(db.Sequelize.col("amount"), "INTEGER")
        ),
        "total",
      ],
    ],
    raw: true,
  });
  const totalAmount = totalAmountResult[0]?.total || 0;

  // By semester
  const bySemester = await CourseOrder.findAll({
    attributes: [
      "semester",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
      [
        db.Sequelize.fn(
          "SUM",
          db.Sequelize.cast(db.Sequelize.col("amount"), "INTEGER")
        ),
        "total",
      ],
    ],
    group: ["semester"],
    raw: true,
  });

  // By academic year
  const byAcademicYear = await CourseOrder.findAll({
    attributes: [
      "academic_year",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
      [
        db.Sequelize.fn(
          "SUM",
          db.Sequelize.cast(db.Sequelize.col("amount"), "INTEGER")
        ),
        "total",
      ],
    ],
    group: ["academic_year"],
    raw: true,
  });

  res.status(200).json({
    success: true,
    message: "Course order statistics retrieved successfully",
    data: {
      total: totalOrders,
      totalAmount: totalAmount || 0,
      bySemester,
      byAcademicYear,
    },
  });
});

/**
 * Get payment overview (all payment types summary)
 */
export const getPaymentOverview = TryCatchFunction(async (req, res) => {
  const [fundingStats, schoolFeesStats, courseOrderStats] = await Promise.all([
    Funding.findAll({
      attributes: [
        [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
        [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "total"],
        "type",
        "currency",
      ],
      group: ["type", "currency"],
      raw: true,
    }),
    SchoolFees.findAll({
      attributes: [
        [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
        [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "total"],
        "status",
      ],
      group: ["status"],
      raw: true,
    }),
    CourseOrder.findAll({
      attributes: [
        [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
        [
          db.Sequelize.fn(
            "SUM",
            db.Sequelize.cast(db.Sequelize.col("amount"), "INTEGER")
          ),
          "total",
        ],
      ],
      raw: true,
    }),
  ]);

  res.status(200).json({
    success: true,
    message: "Payment overview retrieved successfully",
    data: {
      funding: fundingStats,
      schoolFees: schoolFeesStats,
      courseOrders: courseOrderStats[0] || { count: 0, total: 0 },
    },
  });
});

