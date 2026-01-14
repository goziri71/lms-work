/**
 * Donation Controller
 * Handles donation creation, listing, and donation wall
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Donation } from "../../models/marketplace/donation.js";
import { DonationCategory } from "../../models/marketplace/donationCategory.js";
import { Students } from "../../models/auth/student.js";
import { createInvoice } from "../../services/invoiceService.js";
import { Op, QueryTypes } from "sequelize";
import { db } from "../../database/database.js";

/**
 * Get all donation categories
 * GET /api/marketplace/donations/categories
 */
export const getDonationCategories = TryCatchFunction(async (req, res) => {
  const categories = await DonationCategory.findAll({
    where: {
      is_active: true,
    },
    order: [["name", "ASC"]],
  });

  res.status(200).json({
    success: true,
    message: "Donation categories retrieved successfully",
    data: {
      categories,
    },
  });
});

/**
 * Create a donation
 * POST /api/marketplace/donations
 */
export const createDonation = TryCatchFunction(async (req, res) => {
  const userId = req.user?.id || null;
  const userType = req.user?.userType;
  const {
    amount,
    currency = "NGN",
    category_id,
    message,
    visibility = "public",
    donor_name,
    donor_email,
    payment_method,
    payment_reference,
    payment_status = "pending",
  } = req.body;

  if (!amount || parseFloat(amount) <= 0) {
    throw new ErrorClass("Donation amount is required and must be greater than 0", 400);
  }

  if (!["public", "private", "anonymous"].includes(visibility)) {
    throw new ErrorClass("Invalid visibility. Must be 'public', 'private', or 'anonymous'", 400);
  }

  // Validate category if provided
  if (category_id) {
    const category = await DonationCategory.findOne({
      where: {
        id: category_id,
        is_active: true,
      },
    });

    if (!category) {
      throw new ErrorClass("Invalid donation category", 400);
    }
  }

  // Get donor info
  let donorId = null;
  let donorName = donor_name || null;
  let donorEmail = donor_email || null;

  if (userId && userType === "student") {
    donorId = userId;
    const student = await Students.findByPk(userId, {
      attributes: ["id", "fname", "lname", "mname", "email"],
    });
    if (student) {
      donorName = donorName || `${student.fname} ${student.lname || ""}`.trim();
      donorEmail = donorEmail || student.email;
    }
  } else if (!donor_name) {
    // Anonymous donation requires a name
    if (visibility === "anonymous") {
      donorName = "Anonymous";
    } else {
      throw new ErrorClass("Donor name is required for non-logged-in users", 400);
    }
  }

  // Create donation
  const donation = await Donation.create({
    donor_id: donorId,
    donor_name: donorName,
    donor_email: donorEmail,
    amount: parseFloat(amount),
    currency,
    category_id: category_id || null,
    message: message || null,
    visibility,
    payment_method: payment_method || null,
    payment_reference: payment_reference || null,
    payment_status,
    donated_at: new Date(),
  });

  // Generate invoice if payment is completed
  let invoice = null;
  if (payment_status === "completed") {
    try {
      invoice = await createInvoice({
        student_id: donorId,
        product_type: "donation",
        product_id: donation.id,
        product_name: `Donation${category_id ? ` - ${(await DonationCategory.findByPk(category_id))?.name || "General"}` : ""}`,
        quantity: 1,
        unit_price: parseFloat(amount),
        subtotal: parseFloat(amount),
        tax_amount: 0,
        discount_amount: 0,
        total_amount: parseFloat(amount),
        currency,
        payment_method,
        payment_reference,
        payment_status: "completed",
        tutor_id: null,
        tutor_type: null,
        billing_address: null,
        notes: message || `Thank you for your donation!`,
      });

      if (invoice) {
        await donation.update({ invoice_id: invoice.id });
      }
    } catch (error) {
      console.error("Error creating invoice for donation:", error);
      // Don't fail donation creation if invoice fails
    }
  }

  res.status(201).json({
    success: true,
    message: "Donation created successfully",
    data: {
      donation: {
        id: donation.id,
        amount: donation.amount,
        currency: donation.currency,
        visibility: donation.visibility,
        payment_status: donation.payment_status,
        donated_at: donation.donated_at,
      },
      invoice_id: invoice?.id || null,
    },
  });
});

/**
 * Get donation wall (public donations only)
 * GET /api/marketplace/donations/wall
 */
export const getDonationWall = TryCatchFunction(async (req, res) => {
  const { category_id, page = 1, limit = 50, sort = "recent" } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    visibility: "public",
    payment_status: "completed",
  };

  if (category_id) {
    where.category_id = parseInt(category_id);
  }

  // Determine sort order
  let order = [["donated_at", "DESC"]];
  if (sort === "amount_high") {
    order = [["amount", "DESC"]];
  } else if (sort === "amount_low") {
    order = [["amount", "ASC"]];
  } else if (sort === "recent") {
    order = [["donated_at", "DESC"]];
  } else if (sort === "oldest") {
    order = [["donated_at", "ASC"]];
  }

  const { count, rows: donations } = await Donation.findAndCountAll({
    where,
    include: [
      {
        model: DonationCategory,
        as: "category",
        attributes: ["id", "name", "icon"],
      },
    ],
    limit: parseInt(limit),
    offset,
    order,
  });

  // Format donations for display
  const formattedDonations = donations.map((donation) => {
    // Handle anonymous donations
    let displayName = "Anonymous";
    if (donation.visibility === "public") {
      displayName = donation.donor_name || "Anonymous";
    }

    return {
      id: donation.id,
      donor_name: displayName,
      amount: parseFloat(donation.amount),
      currency: donation.currency,
      category: donation.category
        ? {
            id: donation.category.id,
            name: donation.category.name,
            icon: donation.category.icon,
          }
        : null,
      message: donation.message,
      donated_at: donation.donated_at,
    };
  });

  // Calculate total donations
  const totalResult = await Donation.sum("amount", {
    where: {
      visibility: "public",
      payment_status: "completed",
    },
  });

  res.status(200).json({
    success: true,
    message: "Donation wall retrieved successfully",
    data: {
      donations: formattedDonations,
      total_donations: parseFloat(totalResult || 0),
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
 * Get my donations (for logged-in users)
 * GET /api/marketplace/donations/my-donations
 */
export const getMyDonations = TryCatchFunction(async (req, res) => {
  const userId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can view their donations", 403);
  }

  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: donations } = await Donation.findAndCountAll({
    where: {
      donor_id: userId,
    },
    include: [
      {
        model: DonationCategory,
        as: "category",
        attributes: ["id", "name", "icon"],
      },
    ],
    limit: parseInt(limit),
    offset,
    order: [["donated_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Donations retrieved successfully",
    data: {
      donations,
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
 * Get donation statistics
 * GET /api/marketplace/donations/statistics
 */
export const getDonationStatistics = TryCatchFunction(async (req, res) => {
  const { category_id } = req.query;

  const where = {
    payment_status: "completed",
  };

  if (category_id) {
    where.category_id = parseInt(category_id);
  }

  // Total amount
  const totalAmount = await Donation.sum("amount", { where });

  // Total count
  const totalCount = await Donation.count({ where });

  // Average donation
  const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

  // Donations by category - using raw query for aggregation
  const donationsByCategoryRaw = await db.query(
    `
    SELECT 
      d.category_id,
      COUNT(d.id) as count,
      COALESCE(SUM(d.amount), 0) as total,
      dc.id as "category.id",
      dc.name as "category.name",
      dc.icon as "category.icon"
    FROM donations d
    LEFT JOIN donation_categories dc ON d.category_id = dc.id
    WHERE d.payment_status = :payment_status
    ${category_id ? "AND d.category_id = :category_id" : ""}
    GROUP BY d.category_id, dc.id, dc.name, dc.icon
    ORDER BY total DESC
    `,
    {
      replacements: {
        payment_status: "completed",
        category_id: category_id ? parseInt(category_id) : null,
      },
      type: QueryTypes.SELECT,
    }
  );

  const donationsByCategory = donationsByCategoryRaw.map((item) => ({
    category: item["category.id"]
      ? {
          id: item["category.id"],
          name: item["category.name"],
          icon: item["category.icon"],
        }
      : null,
    count: parseInt(item.count || 0),
    total: parseFloat(item.total || 0),
  }));

  // Recent donations (last 10)
  const recentDonations = await Donation.findAll({
    where: {
      ...where,
      visibility: "public",
    },
    limit: 10,
    order: [["donated_at", "DESC"]],
    attributes: ["id", "amount", "currency", "donated_at"],
  });

  res.status(200).json({
    success: true,
    message: "Donation statistics retrieved successfully",
    data: {
      total_amount: parseFloat(totalAmount || 0),
      total_count: totalCount,
      average_amount: parseFloat(averageAmount.toFixed(2)),
      by_category: donationsByCategory,
      recent_donations: recentDonations.map((d) => ({
        id: d.id,
        amount: parseFloat(d.amount),
        currency: d.currency,
        donated_at: d.donated_at,
      })),
    },
  });
});
