/**
 * Fund Transfer Controller (Admin Only)
 * Handles fund transfer initiation and management by super admin
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { FundTransfer } from "../../models/marketplace/fundTransfer.js";
import { TutorNextOfKin } from "../../models/marketplace/tutorNextOfKin.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { TutorWalletTransaction } from "../../models/marketplace/tutorWalletTransaction.js";
import { Op } from "sequelize";
import { db } from "../../database/database.js";

/**
 * Initiate fund transfer to next of kin
 * POST /api/admin/fund-transfers
 */
export const initiateFundTransfer = TryCatchFunction(async (req, res) => {
  const adminId = req.user?.id;
  const userType = req.user?.userType;

  // Verify admin access
  if (userType !== "admin" && userType !== "super_admin") {
    throw new ErrorClass("Only admins can initiate fund transfers", 403);
  }

  const {
    tutor_id,
    tutor_type,
    transfer_reason,
    reason_description,
    transfer_method = "bank_transfer",
    supporting_documents,
    notes,
  } = req.body;

  // Validate required fields
  if (!tutor_id || !tutor_type || !transfer_reason) {
    throw new ErrorClass("Tutor ID, tutor type, and transfer reason are required", 400);
  }

  if (!["sole_tutor", "organization"].includes(tutor_type)) {
    throw new ErrorClass("Invalid tutor type", 400);
  }

  if (!["death", "inactivity", "account_closure", "other"].includes(transfer_reason)) {
    throw new ErrorClass("Invalid transfer reason", 400);
  }

  // Get tutor and verify existence
  let tutor = null;
  if (tutor_type === "sole_tutor") {
    tutor = await SoleTutor.findByPk(tutor_id);
  } else {
    tutor = await Organization.findByPk(tutor_id);
  }

  if (!tutor) {
    throw new ErrorClass("Tutor not found", 404);
  }

  // Get next of kin
  const nextOfKin = await TutorNextOfKin.findOne({
    where: {
      tutor_id,
      tutor_type,
      status: "active",
    },
  });

  if (!nextOfKin) {
    throw new ErrorClass("No active next of kin found for this tutor", 404);
  }

  if (!nextOfKin.is_verified) {
    throw new ErrorClass("Next of kin must be verified before fund transfer", 400);
  }

  // Get wallet balances
  const walletBalancePrimary = parseFloat(tutor.wallet_balance_primary || 0);
  const walletBalanceUsd = parseFloat(tutor.wallet_balance_usd || 0);
  const walletBalanceGbp = parseFloat(tutor.wallet_balance_gbp || 0);
  const primaryCurrency = tutor.local_currency || "NGN";

  if (walletBalancePrimary === 0 && walletBalanceUsd === 0 && walletBalanceGbp === 0) {
    throw new ErrorClass("Tutor wallet has no funds to transfer", 400);
  }

  // Create fund transfer record
  const fundTransfer = await FundTransfer.create({
    tutor_id,
    tutor_type,
    next_of_kin_id: nextOfKin.id,
    transfer_reason,
    reason_description: reason_description || null,
    amount_primary: walletBalancePrimary,
    amount_usd: walletBalanceUsd,
    amount_gbp: walletBalanceGbp,
    currency_primary: primaryCurrency,
    total_amount_ngn_equivalent: null, // Can be calculated later with exchange rates
    transfer_method,
    transfer_reference: null, // Will be set when transfer is completed
    initiated_by: adminId,
    initiated_at: new Date(),
    status: "pending",
    supporting_documents: supporting_documents || null,
    notes: notes || null,
  });

  res.status(201).json({
    success: true,
    message: "Fund transfer initiated successfully",
    data: {
      fund_transfer: fundTransfer,
      wallet_balances: {
        primary: walletBalancePrimary,
        currency: primaryCurrency,
        usd: walletBalanceUsd,
        gbp: walletBalanceGbp,
      },
      next_of_kin: {
        id: nextOfKin.id,
        full_name: nextOfKin.full_name,
        bank_account_name: nextOfKin.bank_account_name,
        bank_account_number: nextOfKin.bank_account_number,
        bank_name: nextOfKin.bank_name,
      },
    },
  });
});

/**
 * Complete fund transfer (after actual transfer is done)
 * PUT /api/admin/fund-transfers/:id/complete
 */
export const completeFundTransfer = TryCatchFunction(async (req, res) => {
  const adminId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "admin" && userType !== "super_admin") {
    throw new ErrorClass("Only admins can complete fund transfers", 403);
  }

  const { id } = req.params;
  const { transfer_reference, notes } = req.body;

  const fundTransfer = await FundTransfer.findByPk(id, {
    include: [
      {
        model: TutorNextOfKin,
        as: "next_of_kin",
      },
    ],
  });

  if (!fundTransfer) {
    throw new ErrorClass("Fund transfer not found", 404);
  }

  if (fundTransfer.status !== "pending" && fundTransfer.status !== "processing") {
    throw new ErrorClass(`Cannot complete fund transfer with status: ${fundTransfer.status}`, 400);
  }

  // Get tutor
  let tutor = null;
  if (fundTransfer.tutor_type === "sole_tutor") {
    tutor = await SoleTutor.findByPk(fundTransfer.tutor_id);
  } else {
    tutor = await Organization.findByPk(fundTransfer.tutor_id);
  }

  if (!tutor) {
    throw new ErrorClass("Tutor not found", 404);
  }

  // Start transaction to update wallet and create transaction records
  const transaction = await db.transaction();

  try {
    // Deduct funds from tutor wallet
    await tutor.update(
      {
        wallet_balance_primary: 0,
        wallet_balance_usd: 0,
        wallet_balance_gbp: 0,
      },
      { transaction }
    );

    // Create wallet transaction records for each currency
    if (fundTransfer.amount_primary > 0) {
      await TutorWalletTransaction.create(
        {
          tutor_id: fundTransfer.tutor_id,
          tutor_type: fundTransfer.tutor_type,
          transaction_type: "debit",
          amount: fundTransfer.amount_primary,
          currency: fundTransfer.currency_primary,
          description: `Fund transfer to next of kin: ${fundTransfer.transfer_reason}`,
          reference: transfer_reference || `FT-${fundTransfer.id}`,
          status: "completed",
        },
        { transaction }
      );
    }

    if (fundTransfer.amount_usd > 0) {
      await TutorWalletTransaction.create(
        {
          tutor_id: fundTransfer.tutor_id,
          tutor_type: fundTransfer.tutor_type,
          transaction_type: "debit",
          amount: fundTransfer.amount_usd,
          currency: "USD",
          description: `Fund transfer to next of kin: ${fundTransfer.transfer_reason}`,
          reference: transfer_reference || `FT-${fundTransfer.id}`,
          status: "completed",
        },
        { transaction }
      );
    }

    if (fundTransfer.amount_gbp > 0) {
      await TutorWalletTransaction.create(
        {
          tutor_id: fundTransfer.tutor_id,
          tutor_type: fundTransfer.tutor_type,
          transaction_type: "debit",
          amount: fundTransfer.amount_gbp,
          currency: "GBP",
          description: `Fund transfer to next of kin: ${fundTransfer.transfer_reason}`,
          reference: transfer_reference || `FT-${fundTransfer.id}`,
          status: "completed",
        },
        { transaction }
      );
    }

    // Update fund transfer status
    await fundTransfer.update(
      {
        status: "completed",
        transfer_reference: transfer_reference || null,
        completed_at: new Date(),
        notes: notes || fundTransfer.notes,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Fund transfer completed successfully",
      data: {
        fund_transfer: fundTransfer,
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Get all fund transfers (with filters)
 * GET /api/admin/fund-transfers
 */
export const getAllFundTransfers = TryCatchFunction(async (req, res) => {
  const userType = req.user?.userType;

  if (userType !== "admin" && userType !== "super_admin") {
    throw new ErrorClass("Only admins can view fund transfers", 403);
  }

  const { status, tutor_type, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (status) {
    where.status = status;
  }
  if (tutor_type) {
    where.tutor_type = tutor_type;
  }

  const { count, rows: fundTransfers } = await FundTransfer.findAndCountAll({
    where,
    include: [
      {
        model: TutorNextOfKin,
        as: "next_of_kin",
        attributes: ["id", "full_name", "phone_number", "email", "bank_account_name", "bank_account_number", "bank_name"],
      },
    ],
    limit: parseInt(limit),
    offset,
    order: [["initiated_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Fund transfers retrieved successfully",
    data: {
      fund_transfers: fundTransfers,
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
 * Get single fund transfer by ID
 * GET /api/admin/fund-transfers/:id
 */
export const getFundTransferById = TryCatchFunction(async (req, res) => {
  const userType = req.user?.userType;

  if (userType !== "admin" && userType !== "super_admin") {
    throw new ErrorClass("Only admins can view fund transfers", 403);
  }

  const { id } = req.params;

  const fundTransfer = await FundTransfer.findByPk(id, {
    include: [
      {
        model: TutorNextOfKin,
        as: "next_of_kin",
      },
    ],
  });

  if (!fundTransfer) {
    throw new ErrorClass("Fund transfer not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Fund transfer retrieved successfully",
    data: {
      fund_transfer: fundTransfer,
    },
  });
});

/**
 * Cancel fund transfer
 * PUT /api/admin/fund-transfers/:id/cancel
 */
export const cancelFundTransfer = TryCatchFunction(async (req, res) => {
  const userType = req.user?.userType;

  if (userType !== "admin" && userType !== "super_admin") {
    throw new ErrorClass("Only admins can cancel fund transfers", 403);
  }

  const { id } = req.params;
  const { reason } = req.body;

  const fundTransfer = await FundTransfer.findByPk(id);

  if (!fundTransfer) {
    throw new ErrorClass("Fund transfer not found", 404);
  }

  if (fundTransfer.status === "completed") {
    throw new ErrorClass("Cannot cancel a completed fund transfer", 400);
  }

  if (fundTransfer.status === "cancelled") {
    throw new ErrorClass("Fund transfer is already cancelled", 400);
  }

  await fundTransfer.update({
    status: "cancelled",
    failure_reason: reason || "Cancelled by admin",
  });

  res.status(200).json({
    success: true,
    message: "Fund transfer cancelled successfully",
    data: {
      fund_transfer: fundTransfer,
    },
  });
});
