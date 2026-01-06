import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TutorBankAccount } from "../../models/marketplace/tutorBankAccount.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { getBanks, verifyBankAccount } from "../../services/flutterwaveService.js";
import { getCurrencyFromCountry } from "../../services/currencyService.js";
import { Op } from "sequelize";
import { db } from "../../database/database.js";

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
 * Get list of banks for a country
 * GET /api/marketplace/tutor/bank-accounts/banks?country=NG
 */
export const getBanksList = TryCatchFunction(async (req, res) => {
  const { country = "NG" } = req.query;

  if (!country) {
    throw new ErrorClass("Country code is required", 400);
  }

  const result = await getBanks(country.toUpperCase());

  if (!result.success) {
    throw new ErrorClass(result.message || "Failed to fetch banks", 500);
  }

  res.json({
    success: true,
    data: {
      banks: result.banks || [],
      country: country.toUpperCase(),
    },
  });
});

/**
 * Add bank account
 * POST /api/marketplace/tutor/bank-accounts
 */
export const addBankAccount = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const {
    account_name,
    account_number,
    bank_code,
    bank_name,
    country,
    verify = true,
  } = req.body;

  // Validate required fields
  if (!account_name || !account_number || !bank_code || !bank_name || !country) {
    throw new ErrorClass(
      "account_name, account_number, bank_code, bank_name, and country are required",
      400
    );
  }

  // Get currency from country
  const currency = getCurrencyFromCountry(country);

  // Verify account if requested
  let isVerified = false;
  let verificationResponse = null;
  let verificationDate = null;
  let verifiedAccountName = account_name; // Default to provided name
  let verifiedAccountNumber = account_number; // Default to provided number

  if (verify) {
    try {
      const verification = await verifyBankAccount(
        account_number,
        bank_code,
        country.toUpperCase()
      );

      if (verification.success && verification.account) {
        // Update with verified account details from Flutterwave
        if (verification.account.accountName) {
          verifiedAccountName = verification.account.accountName;
        }
        if (verification.account.accountNumber) {
          verifiedAccountNumber = verification.account.accountNumber;
        }
        
        // Store verification response
        verificationResponse = verification.account;
        verificationDate = new Date();
        
        // Only mark as verified after we have the verified details
        isVerified = true;
      } else {
        // Account verification failed, but we can still save it
        verificationResponse = { error: verification.message };
        isVerified = false;
      }
    } catch (error) {
      console.error("Bank account verification error:", error);
      verificationResponse = { error: error.message };
      isVerified = false;
      // Continue without verification - account will be saved as unverified
    }
  }

  // Check if this will be the primary account (first account or explicitly set)
  const existingAccounts = await TutorBankAccount.count({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  const isPrimary = existingAccounts === 0; // First account is primary

  // If setting as primary, unset other primary accounts
  if (isPrimary) {
    await TutorBankAccount.update(
      { is_primary: false },
      {
        where: {
          tutor_id: tutorId,
          tutor_type: tutorType,
          is_primary: true,
        },
      }
    );
  }

  // Create bank account with verified details
  const bankAccount = await TutorBankAccount.create({
    tutor_id: tutorId,
    tutor_type: tutorType,
    account_name: verifiedAccountName, // Use verified name from Flutterwave
    account_number: verifiedAccountNumber, // Use verified number from Flutterwave
    bank_code,
    bank_name,
    country: country.toUpperCase(),
    currency,
    is_verified: isVerified, // Only true if verification succeeded
    is_primary: isPrimary,
    verification_date: verificationDate,
    verification_response: verificationResponse,
  });

  res.status(201).json({
    success: true,
    message: isVerified 
      ? "Bank account added and verified successfully" 
      : "Bank account added. Please verify the account details.",
    data: {
      id: bankAccount.id,
      account_name: bankAccount.account_name, // This now contains the verified name from Flutterwave
      account_number: bankAccount.account_number.replace(/(.{4})(.*)/, "$1****"), // Mask account number
      bank_name: bankAccount.bank_name,
      country: bankAccount.country,
      currency: bankAccount.currency,
      is_verified: bankAccount.is_verified,
      is_primary: bankAccount.is_primary,
      verification_date: bankAccount.verification_date,
      ...(verificationResponse && !isVerified && { 
        verification_error: verificationResponse.error || "Account verification failed" 
      }),
    },
  });
});

/**
 * List bank accounts
 * GET /api/marketplace/tutor/bank-accounts
 */
export const listBankAccounts = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);

  const accounts = await TutorBankAccount.findAll({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
    order: [
      ["is_primary", "DESC"],
      ["created_at", "DESC"],
    ],
    attributes: [
      "id",
      "account_name",
      "account_number",
      "bank_code",
      "bank_name",
      "country",
      "currency",
      "is_verified",
      "is_primary",
      "verification_date",
      "created_at",
    ],
  });

  res.json({
    success: true,
    data: {
      accounts: accounts.map((acc) => ({
        id: acc.id,
        account_name: acc.account_name,
        account_number: acc.account_number.replace(/(.{4})(.*)/, "$1****"), // Mask account number
        bank_name: acc.bank_name,
        country: acc.country,
        currency: acc.currency,
        is_verified: acc.is_verified,
        is_primary: acc.is_primary,
        verification_date: acc.verification_date,
        created_at: acc.created_at,
      })),
    },
  });
});

/**
 * Verify bank account
 * POST /api/marketplace/tutor/bank-accounts/:id/verify
 */
export const verifyAccount = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const account = await TutorBankAccount.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!account) {
    throw new ErrorClass("Bank account not found", 404);
  }

  // Verify with Flutterwave
  const verification = await verifyBankAccount(
    account.account_number,
    account.bank_code,
    account.country
  );

  if (verification.success && verification.account) {
    // Update account with verified details from Flutterwave
    const verifiedAccountName = verification.account.accountName || account.account_name;
    const verifiedAccountNumber = verification.account.accountNumber || account.account_number;
    
    await account.update({
      account_name: verifiedAccountName, // Update with verified name
      account_number: verifiedAccountNumber, // Update with verified number (in case of formatting)
      is_verified: true, // Only set to true after updating with verified details
      verification_date: new Date(),
      verification_response: verification.account,
    });

    res.json({
      success: true,
      message: "Bank account verified successfully",
      data: {
        id: account.id,
        account_name: verifiedAccountName,
        account_number: account.account_number.replace(/(.{4})(.*)/, "$1****"), // Mask account number
        is_verified: true,
        verification_date: new Date(),
      },
    });
  } else {
    await account.update({
      is_verified: false,
      verification_response: { error: verification.message },
    });

    throw new ErrorClass(
      verification.message || "Account verification failed. Please check your account number and bank code.",
      400
    );
  }
});

/**
 * Set primary account
 * PUT /api/marketplace/tutor/bank-accounts/:id/set-primary
 */
export const setPrimaryAccount = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const account = await TutorBankAccount.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!account) {
    throw new ErrorClass("Bank account not found", 404);
  }

  // Unset all primary accounts
  await TutorBankAccount.update(
    { is_primary: false },
    {
      where: {
        tutor_id: tutorId,
        tutor_type: tutorType,
      },
    }
  );

  // Set this account as primary
  await account.update({ is_primary: true });

  res.json({
    success: true,
    message: "Primary account updated successfully",
    data: {
      id: account.id,
      is_primary: true,
    },
  });
});

/**
 * Delete bank account
 * DELETE /api/marketplace/tutor/bank-accounts/:id
 */
export const deleteBankAccount = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const account = await TutorBankAccount.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!account) {
    throw new ErrorClass("Bank account not found", 404);
  }

  // Check if there are any payouts using this account (foreign key constraint prevents deletion)
  const { TutorPayout } = await import("../../models/marketplace/tutorPayout.js");
  
  // Check for pending/processing payouts (critical - these must be resolved first)
  const pendingPayouts = await TutorPayout.count({
    where: {
      bank_account_id: id,
      status: {
        [Op.in]: ["pending", "processing"],
      },
    },
  });

  if (pendingPayouts > 0) {
    throw new ErrorClass(
      "Cannot delete bank account with pending or processing payouts. Please wait for these payouts to complete or cancel them first.",
      400
    );
  }

  // Check for any payouts at all (for audit purposes, we keep accounts with payout history)
  const allPayouts = await TutorPayout.count({
    where: {
      bank_account_id: id,
    },
  });

  if (allPayouts > 0) {
    throw new ErrorClass(
      `Cannot delete bank account that has been used for ${allPayouts} payout(s). Bank accounts with payout history cannot be deleted for audit purposes. You can add a new account and set it as primary instead.`,
      400
    );
  }

  // If it's primary, set another account as primary if available
  if (account.is_primary) {
    const otherAccount = await TutorBankAccount.findOne({
      where: {
        tutor_id: tutorId,
        tutor_type: tutorType,
        id: { [Op.ne]: id },
      },
      order: [["created_at", "DESC"]],
    });

    if (otherAccount) {
      await otherAccount.update({ is_primary: true });
    }
  }

  await account.destroy();

  res.json({
    success: true,
    message: "Bank account deleted successfully",
  });
});

