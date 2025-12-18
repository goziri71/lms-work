import { Op } from "sequelize";
import { PaymentSetup } from "../../../models/payment/paymentSetup.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";

/**
 * Get all payment setup items
 * GET /api/admin/payment-setup
 */
export const getAllPaymentSetup = TryCatchFunction(async (req, res) => {
  const { semester, currency, page = 1, limit = 50 } = req.query;

  const where = {};
  if (semester) where.semester = semester;
  if (currency) where.currency = currency;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: paymentSetupItems } = await PaymentSetup.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["semester", "ASC"], ["item", "ASC"]],
  });

  res.status(200).json({
    success: true,
    message: "Payment setup items retrieved successfully",
    data: {
      paymentSetup: paymentSetupItems,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

/**
 * Get payment setup item by ID
 * GET /api/admin/payment-setup/:id
 */
export const getPaymentSetupById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const paymentSetup = await PaymentSetup.findByPk(id);

  if (!paymentSetup) {
    throw new ErrorClass("Payment setup item not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Payment setup item retrieved successfully",
    data: {
      paymentSetup,
    },
  });
});

/**
 * Create payment setup item
 * POST /api/admin/payment-setup
 */
export const createPaymentSetup = TryCatchFunction(async (req, res) => {
  const { item, amount, description, semester, currency } = req.body;

  if (!item || amount === undefined || !semester || !currency) {
    throw new ErrorClass(
      "item, amount, semester, and currency are required",
      400
    );
  }

  // Validate amount is positive
  const amountNum = parseInt(amount);
  if (isNaN(amountNum) || amountNum < 0) {
    throw new ErrorClass("amount must be a positive number", 400);
  }

  // Validate semester
  if (semester !== "1ST" && semester !== "2ND") {
    throw new ErrorClass("semester must be '1ST' or '2ND'", 400);
  }

  // Validate currency
  const validCurrencies = ["NGN", "USD", "GBP", "EUR"];
  if (!validCurrencies.includes(currency.toUpperCase())) {
    throw new ErrorClass(
      `currency must be one of: ${validCurrencies.join(", ")}`,
      400
    );
  }

  const paymentSetup = await PaymentSetup.create({
    item: item.trim(),
    amount: amountNum,
    description: description?.trim() || "",
    semester: semester.toUpperCase(),
    currency: currency.toUpperCase(),
  });

  // Log admin activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "created_payment_setup",
        "payment_setup",
        paymentSetup.id,
        {
          item: paymentSetup.item,
          amount: paymentSetup.amount,
          semester: paymentSetup.semester,
          currency: paymentSetup.currency,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(201).json({
    success: true,
    message: "Payment setup item created successfully",
    data: {
      paymentSetup,
    },
  });
});

/**
 * Update payment setup item
 * PUT /api/admin/payment-setup/:id
 */
export const updatePaymentSetup = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { item, amount, description, semester, currency } = req.body;

  const paymentSetup = await PaymentSetup.findByPk(id);

  if (!paymentSetup) {
    throw new ErrorClass("Payment setup item not found", 404);
  }

  const updateData = {};

  if (item !== undefined) {
    updateData.item = item.trim();
  }

  if (amount !== undefined) {
    const amountNum = parseInt(amount);
    if (isNaN(amountNum) || amountNum < 0) {
      throw new ErrorClass("amount must be a positive number", 400);
    }
    updateData.amount = amountNum;
  }

  if (description !== undefined) {
    updateData.description = description?.trim() || "";
  }

  if (semester !== undefined) {
    if (semester !== "1ST" && semester !== "2ND") {
      throw new ErrorClass("semester must be '1ST' or '2ND'", 400);
    }
    updateData.semester = semester.toUpperCase();
  }

  if (currency !== undefined) {
    const validCurrencies = ["NGN", "USD", "GBP", "EUR"];
    if (!validCurrencies.includes(currency.toUpperCase())) {
      throw new ErrorClass(
        `currency must be one of: ${validCurrencies.join(", ")}`,
        400
      );
    }
    updateData.currency = currency.toUpperCase();
  }

  await paymentSetup.update(updateData);

  // Log admin activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "updated_payment_setup",
        "payment_setup",
        id,
        updateData
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Payment setup item updated successfully",
    data: {
      paymentSetup,
    },
  });
});

/**
 * Delete payment setup item
 * DELETE /api/admin/payment-setup/:id
 */
export const deletePaymentSetup = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const paymentSetup = await PaymentSetup.findByPk(id);

  if (!paymentSetup) {
    throw new ErrorClass("Payment setup item not found", 404);
  }

  const deletedData = {
    id: paymentSetup.id,
    item: paymentSetup.item,
    amount: paymentSetup.amount,
    semester: paymentSetup.semester,
    currency: paymentSetup.currency,
  };

  await paymentSetup.destroy();

  // Log admin activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "deleted_payment_setup",
        "payment_setup",
        id,
        deletedData
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Payment setup item deleted successfully",
  });
});

/**
 * Get payment setup statistics
 * GET /api/admin/payment-setup/stats
 */
export const getPaymentSetupStats = TryCatchFunction(async (req, res) => {
  const totalItems = await PaymentSetup.count();

  // Group by semester
  const bySemester = await PaymentSetup.findAll({
    attributes: [
      "semester",
      [PaymentSetup.sequelize.fn("COUNT", PaymentSetup.sequelize.col("id")), "count"],
      [PaymentSetup.sequelize.fn("SUM", PaymentSetup.sequelize.col("amount")), "total_amount"],
    ],
    group: ["semester"],
    raw: true,
  });

  // Group by currency
  const byCurrency = await PaymentSetup.findAll({
    attributes: [
      "currency",
      [PaymentSetup.sequelize.fn("COUNT", PaymentSetup.sequelize.col("id")), "count"],
      [PaymentSetup.sequelize.fn("SUM", PaymentSetup.sequelize.col("amount")), "total_amount"],
    ],
    group: ["currency"],
    raw: true,
  });

  // Group by item type
  const byItem = await PaymentSetup.findAll({
    attributes: [
      "item",
      [PaymentSetup.sequelize.fn("COUNT", PaymentSetup.sequelize.col("id")), "count"],
      [PaymentSetup.sequelize.fn("SUM", PaymentSetup.sequelize.col("amount")), "total_amount"],
    ],
    group: ["item"],
    raw: true,
  });

  res.status(200).json({
    success: true,
    message: "Payment setup statistics retrieved successfully",
    data: {
      total: totalItems,
      bySemester,
      byCurrency,
      byItem,
    },
  });
});

