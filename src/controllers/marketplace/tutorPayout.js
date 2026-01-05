import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TutorPayout } from "../../models/marketplace/tutorPayout.js";
import { TutorBankAccount } from "../../models/marketplace/tutorBankAccount.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { initiateTransfer, getTransferStatus } from "../../services/flutterwaveService.js";
import { convertCurrency } from "../../services/fxConversionService.js";
import { Op, Sequelize } from "sequelize";
import { db } from "../../database/database.js";
import crypto from "crypto";

/**
 * Helper to get tutor ID and type from request
 */
function getTutorInfo(req) {
  const userType = req.user.userType;
  let tutorId, tutorType;

  if (userType === "sole_tutor") {
    tutorId = req.tutor.id;
    tutorType = "sole_tutor";
  } else if (userType === "organization" || userType === "organization_user") {
    tutorId = req.tutor.id;
    tutorType = "organization";
  } else {
    throw new ErrorClass("Unauthorized: Tutor access required", 403);
  }

  return { tutorId, tutorType };
}

/**
 * Request payout
 * POST /api/marketplace/tutor/payouts/request
 */
export const requestPayout = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { amount, bank_account_id, currency: requestedCurrency } = req.body;

  // Validate amount
  const payoutAmount = parseFloat(amount);
  if (!payoutAmount || payoutAmount <= 0 || isNaN(payoutAmount)) {
    throw new ErrorClass("Amount must be a valid number greater than 0", 400);
  }

  // Minimum payout amount (e.g., 100 NGN or equivalent)
  const MIN_PAYOUT_AMOUNT = 100;
  if (payoutAmount < MIN_PAYOUT_AMOUNT) {
    throw new ErrorClass(
      `Minimum payout amount is ${MIN_PAYOUT_AMOUNT}. You requested ${payoutAmount}`,
      400
    );
  }

  // Maximum payout amount (e.g., 10,000,000 NGN or equivalent)
  const MAX_PAYOUT_AMOUNT = 10000000;
  if (payoutAmount > MAX_PAYOUT_AMOUNT) {
    throw new ErrorClass(
      `Maximum payout amount is ${MAX_PAYOUT_AMOUNT}. Please contact support for larger payouts.`,
      400
    );
  }

  // Check for pending/processing payouts to prevent multiple simultaneous requests
  const pendingPayouts = await TutorPayout.sum("amount", {
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: {
        [Op.in]: ["pending", "processing"],
      },
    },
  });

  if (pendingPayouts && pendingPayouts > 0) {
    throw new ErrorClass(
      `You have pending payouts totaling ${pendingPayouts}. Please wait for them to complete before requesting a new payout.`,
      400
    );
  }

  // Use SERIALIZABLE transaction isolation to prevent race conditions
  const transaction = await db.transaction({
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  });

  let tutor;
  try {
    // Lock tutor record for update to prevent race conditions
    // Using SERIALIZABLE isolation + row lock (SELECT FOR UPDATE)
    if (tutorType === "sole_tutor") {
      tutor = await SoleTutor.findByPk(tutorId, {
        lock: Sequelize.Transaction.LOCK.UPDATE,
        transaction,
      });
    } else {
      tutor = await Organization.findByPk(tutorId, {
        lock: Sequelize.Transaction.LOCK.UPDATE,
        transaction,
      });
    }

    if (!tutor) {
      await transaction.rollback();
      throw new ErrorClass("Tutor not found", 404);
    }

    // Re-check wallet balance after locking (prevents race condition)
    const walletBalance = parseFloat(tutor.wallet_balance || 0);
    if (walletBalance < payoutAmount) {
      await transaction.rollback();
      throw new ErrorClass(
        `Insufficient balance. Available: ${walletBalance}`,
        400
      );
    }

    // Get bank account (verify ownership within transaction)
    let bankAccount;
    if (bank_account_id) {
      bankAccount = await TutorBankAccount.findOne({
        where: {
          id: bank_account_id,
          tutor_id: tutorId,
          tutor_type: tutorType,
        },
        transaction,
      });
    } else {
      // Use primary account
      bankAccount = await TutorBankAccount.findOne({
        where: {
          tutor_id: tutorId,
          tutor_type: tutorType,
          is_primary: true,
        },
        transaction,
      });
    }

    if (!bankAccount) {
      await transaction.rollback();
      throw new ErrorClass(
        "Bank account not found. Please add a bank account first.",
        404
      );
    }

    if (!bankAccount.is_verified) {
      await transaction.rollback();
      throw new ErrorClass(
        "Bank account is not verified. Please verify your account first.",
        400
      );
    }

    // Determine payout currency
    const payoutCurrency = requestedCurrency || bankAccount.currency;
    const baseCurrency = "NGN"; // Your base currency (can be configurable)

    // Convert amount if currencies differ
    let convertedAmount = payoutAmount;
    let fxRate = 1;
    let conversionInfo = null;

    if (baseCurrency !== payoutCurrency) {
      conversionInfo = await convertCurrency(payoutAmount, baseCurrency, payoutCurrency);
      convertedAmount = conversionInfo.convertedAmount;
      fxRate = conversionInfo.rate;
    }

    // Generate unique reference
    const reference = `PAYOUT-${tutorId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    // Create payout record
    const payout = await TutorPayout.create(
      {
        tutor_id: tutorId,
        tutor_type: tutorType,
        bank_account_id: bankAccount.id,
        amount: payoutAmount,
        currency: payoutCurrency,
        converted_amount: convertedAmount,
        fx_rate: fxRate,
        transfer_fee: 0, // Will be updated after transfer
        net_amount: convertedAmount, // Will be updated after transfer
        flutterwave_reference: reference,
        status: "pending",
        metadata: {
          conversion: conversionInfo,
          base_currency: baseCurrency,
        },
      },
      { transaction }
    );

    // Deduct from wallet (reserve the amount) - using locked balance
    const newBalance = walletBalance - payoutAmount;
    await tutor.update(
      { wallet_balance: newBalance },
      { transaction }
    );

    await transaction.commit();

    // Initiate transfer asynchronously (don't wait for it)
    processPayoutTransfer(payout.id).catch((error) => {
      console.error(`Failed to process payout ${payout.id}:`, error);
    });

    res.status(201).json({
      success: true,
      message: "Payout request submitted successfully",
      data: {
        id: payout.id,
        amount: parseFloat(payoutAmount),
        currency: payoutCurrency,
        converted_amount: parseFloat(convertedAmount),
        fx_rate: fxRate,
        status: payout.status,
        reference: payout.flutterwave_reference,
        bank_account: {
          bank_name: bankAccount.bank_name,
          account_number: bankAccount.account_number.replace(
            /(.{4})(.*)/,
            "$1****"
          ),
        },
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    // Re-throw ErrorClass instances as-is
    if (error instanceof ErrorClass) {
      throw error;
    }
    // Log unexpected errors
    console.error("Payout request error:", error);
    throw new ErrorClass("Failed to process payout request", 500);
  }
});

/**
 * Process payout transfer (background job)
 * @param {number} payoutId - Payout ID
 */
async function processPayoutTransfer(payoutId) {
  const payout = await TutorPayout.findByPk(payoutId, {
    include: [
      {
        model: TutorBankAccount,
        as: "bankAccount",
      },
    ],
  });

  if (!payout || payout.status !== "pending") {
    return;
  }

  try {
    // Update status to processing
    await payout.update({ status: "processing" });

    // Initiate Flutterwave transfer
    const transferResult = await initiateTransfer({
      accountBank: payout.bankAccount.bank_code,
      accountNumber: payout.bankAccount.account_number,
      amount: payout.converted_amount,
      currency: payout.currency,
      narration: `Payout to ${payout.bankAccount.account_name}`,
      reference: payout.flutterwave_reference,
      beneficiaryName: payout.bankAccount.account_name,
    });

    if (transferResult.success) {
      // Update payout with transfer details
      await payout.update({
        flutterwave_transfer_id: transferResult.transfer.id,
        transfer_fee: transferResult.transfer.fee || 0,
        net_amount: payout.converted_amount - (transferResult.transfer.fee || 0),
        status: "successful",
        processed_at: new Date(),
        metadata: {
          ...payout.metadata,
          transfer: transferResult.transfer,
        },
      });

      // Update tutor's total_payouts
      let tutor;
      if (payout.tutor_type === "sole_tutor") {
        tutor = await SoleTutor.findByPk(payout.tutor_id);
      } else {
        tutor = await Organization.findByPk(payout.tutor_id);
      }

      if (tutor) {
        const newTotalPayouts = parseFloat(tutor.total_payouts || 0) + payout.amount;
        await tutor.update({ total_payouts: newTotalPayouts });
      }
    } else {
      // Transfer failed
      await payout.update({
        status: "failed",
        failure_reason: transferResult.message || "Transfer initiation failed",
        processed_at: new Date(),
      });

      // Refund wallet balance
      let tutor;
      if (payout.tutor_type === "sole_tutor") {
        tutor = await SoleTutor.findByPk(payout.tutor_id);
      } else {
        tutor = await Organization.findByPk(payout.tutor_id);
      }

      if (tutor) {
        const newBalance = parseFloat(tutor.wallet_balance || 0) + payout.amount;
        await tutor.update({ wallet_balance: newBalance });
      }
    }
  } catch (error) {
    console.error(`Error processing payout ${payoutId}:`, error);

    // Update payout status
    await payout.update({
      status: "failed",
      failure_reason: error.message || "Transfer processing error",
      processed_at: new Date(),
    });

    // Refund wallet balance
    let tutor;
    if (payout.tutor_type === "sole_tutor") {
      tutor = await SoleTutor.findByPk(payout.tutor_id);
    } else {
      tutor = await Organization.findByPk(payout.tutor_id);
    }

    if (tutor) {
      const newBalance = parseFloat(tutor.wallet_balance || 0) + payout.amount;
      await tutor.update({ wallet_balance: newBalance });
    }
  }
}

/**
 * List payouts
 * GET /api/marketplace/tutor/payouts
 */
export const listPayouts = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { page = 1, limit = 20, status } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    tutor_id: tutorId,
    tutor_type: tutorType,
  };

  if (status) {
    where.status = status;
  }

  const { count, rows: payouts } = await TutorPayout.findAndCountAll({
    where,
    include: [
      {
        model: TutorBankAccount,
        as: "bankAccount",
        attributes: ["bank_name", "account_number", "currency"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit: parseInt(limit),
    offset,
  });

  res.json({
    success: true,
    data: {
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: parseFloat(p.amount),
        currency: p.currency,
        converted_amount: p.converted_amount
          ? parseFloat(p.converted_amount)
          : null,
        fx_rate: p.fx_rate ? parseFloat(p.fx_rate) : null,
        transfer_fee: parseFloat(p.transfer_fee),
        net_amount: parseFloat(p.net_amount),
        status: p.status,
        reference: p.flutterwave_reference,
        bank_account: p.bankAccount
          ? {
              bank_name: p.bankAccount.bank_name,
              account_number: p.bankAccount.account_number.replace(
                /(.{4})(.*)/,
                "$1****"
              ),
            }
          : null,
        created_at: p.created_at,
        processed_at: p.processed_at,
        completed_at: p.completed_at,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

/**
 * Get payout details
 * GET /api/marketplace/tutor/payouts/:id
 */
export const getPayout = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const payout = await TutorPayout.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
    include: [
      {
        model: TutorBankAccount,
        as: "bankAccount",
      },
    ],
  });

  if (!payout) {
    throw new ErrorClass("Payout not found", 404);
  }

  // Check transfer status if processing or pending
  if (
    payout.status === "processing" ||
    payout.status === "pending"
  ) {
    if (payout.flutterwave_transfer_id) {
      try {
        const statusResult = await getTransferStatus(
          payout.flutterwave_transfer_id
        );
        if (statusResult.success) {
          // Update status if changed
          if (statusResult.transfer.status !== payout.status) {
            const newStatus =
              statusResult.transfer.status === "SUCCESSFUL"
                ? "successful"
                : statusResult.transfer.status === "FAILED"
                ? "failed"
                : payout.status;

            await payout.update({
              status: newStatus,
              completed_at: newStatus === "successful" ? new Date() : null,
            });
          }
        }
      } catch (error) {
        console.error("Error checking transfer status:", error);
      }
    }
  }

  // Refresh payout data
  await payout.reload();

  res.json({
    success: true,
    data: {
      id: payout.id,
      amount: parseFloat(payout.amount),
      currency: payout.currency,
      converted_amount: payout.converted_amount
        ? parseFloat(payout.converted_amount)
        : null,
      fx_rate: payout.fx_rate ? parseFloat(payout.fx_rate) : null,
      transfer_fee: parseFloat(payout.transfer_fee),
      net_amount: parseFloat(payout.net_amount),
      status: payout.status,
      reference: payout.flutterwave_reference,
      flutterwave_transfer_id: payout.flutterwave_transfer_id,
      bank_account: payout.bankAccount
        ? {
            id: payout.bankAccount.id,
            bank_name: payout.bankAccount.bank_name,
            account_name: payout.bankAccount.account_name,
            account_number: payout.bankAccount.account_number.replace(
              /(.{4})(.*)/,
              "$1****"
            ),
            country: payout.bankAccount.country,
            currency: payout.bankAccount.currency,
          }
        : null,
      failure_reason: payout.failure_reason,
      created_at: payout.created_at,
      processed_at: payout.processed_at,
      completed_at: payout.completed_at,
    },
  });
});

