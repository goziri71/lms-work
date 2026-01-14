/**
 * BVN Verification Service
 * Handles BVN verification through VerifyMe API or manual verification
 */

import axios from "axios";
import { ErrorClass } from "../utils/errorClass/index.js";

const VERIFYME_API_URL = process.env.VERIFYME_API_URL || "https://api.verifyme.ng/v1";
const VERIFYME_API_KEY = process.env.VERIFYME_API_KEY;

/**
 * Verify BVN using VerifyMe API
 * @param {string} bvn - Bank Verification Number (11 digits)
 * @param {string} firstName - First name for verification
 * @param {string} lastName - Last name for verification
 * @param {string} dateOfBirth - Date of birth (YYYY-MM-DD)
 * @returns {Promise<Object>} Verification result
 */
export async function verifyBVN(bvn, firstName = null, lastName = null, dateOfBirth = null) {
  // Validate BVN format
  if (!bvn || !/^\d{11}$/.test(bvn)) {
    throw new ErrorClass("Invalid BVN format. BVN must be 11 digits", 400);
  }

  // If API key is not configured, return manual verification required
  if (!VERIFYME_API_KEY) {
    console.warn("⚠️ VerifyMe API key not configured. BVN verification will be manual.");
    return {
      verified: false,
      requires_manual_verification: true,
      message: "BVN verification requires manual review. API key not configured.",
      bvn: bvn,
    };
  }

  try {
    // Call VerifyMe API
    const response = await axios.post(
      `${VERIFYME_API_URL}/verifications/bvn`,
      {
        bvn: bvn,
        ...(firstName && { first_name: firstName }),
        ...(lastName && { last_name: lastName }),
        ...(dateOfBirth && { date_of_birth: dateOfBirth }),
      },
      {
        headers: {
          "Authorization": `Bearer ${VERIFYME_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 seconds timeout
      }
    );

    const data = response.data;

    // Parse VerifyMe response
    if (data.status === "success" || data.verified === true) {
      return {
        verified: true,
        requires_manual_verification: false,
        bvn: data.bvn || bvn,
        first_name: data.first_name || data.firstName || null,
        last_name: data.last_name || data.lastName || null,
        middle_name: data.middle_name || data.middleName || null,
        date_of_birth: data.date_of_birth || data.dateOfBirth || null,
        phone_number: data.phone_number || data.phoneNumber || null,
        email: data.email || null,
        enrollment_bank: data.enrollment_bank || data.enrollmentBank || null,
        enrollment_branch: data.enrollment_branch || data.enrollmentBranch || null,
        reference: data.reference || data.transaction_id || null,
        raw_response: data,
      };
    } else {
      return {
        verified: false,
        requires_manual_verification: true,
        message: data.message || "BVN verification failed",
        bvn: bvn,
        raw_response: data,
      };
    }
  } catch (error) {
    console.error("BVN Verification API Error:", error.response?.data || error.message);

    // Handle API errors
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;

      if (status === 400) {
        throw new ErrorClass(
          errorData.message || "Invalid BVN or verification parameters",
          400
        );
      } else if (status === 401) {
        throw new ErrorClass("BVN verification API authentication failed", 401);
      } else if (status === 404) {
        return {
          verified: false,
          requires_manual_verification: true,
          message: "BVN not found. Requires manual verification.",
          bvn: bvn,
        };
      } else if (status >= 500) {
        throw new ErrorClass(
          "BVN verification service temporarily unavailable. Please try again later.",
          503
        );
      }
    }

    // Network or other errors
    throw new ErrorClass(
      "BVN verification service error. Please try again later or contact support.",
      500
    );
  }
}

/**
 * Validate BVN format
 * @param {string} bvn - Bank Verification Number
 * @returns {boolean} True if valid format
 */
export function validateBVNFormat(bvn) {
  return /^\d{11}$/.test(bvn);
}
