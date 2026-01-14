/**
 * Admin Routes
 * Routes for admin operations (including fund transfers)
 */

import express from "express";
import {
  adminAuthorize,
  requireSuperAdmin,
} from "../middlewares/adminAuthorize.js";
import {
  adminLogin,
  adminLogout,
} from "../controllers/admin/adminAuth.js";
import {
  initiateFundTransfer,
  completeFundTransfer,
  getAllFundTransfers,
  getFundTransferById,
  cancelFundTransfer,
} from "../controllers/admin/fundTransfer.js";
import {
  getAllKycSubmissions,
  getKycSubmissionById,
  approveKyc,
  rejectKyc,
  requestKycResubmission,
  getKycStats,
} from "../controllers/admin/tutorKycManagement.js";

const router = express.Router();

// ============================================
// ADMIN AUTHENTICATION (Public - No auth required)
// ============================================
router.post("/login", adminLogin);
router.post("/logout", adminAuthorize, adminLogout);

// ============================================
// FUND TRANSFER MANAGEMENT (Super Admin Only)
// ============================================
router.post("/fund-transfers", adminAuthorize, requireSuperAdmin, initiateFundTransfer);
router.get("/fund-transfers", adminAuthorize, requireSuperAdmin, getAllFundTransfers);
router.get("/fund-transfers/:id", adminAuthorize, requireSuperAdmin, getFundTransferById);
router.put("/fund-transfers/:id/complete", adminAuthorize, requireSuperAdmin, completeFundTransfer);
router.put("/fund-transfers/:id/cancel", adminAuthorize, requireSuperAdmin, cancelFundTransfer);

// ============================================
// TUTOR KYC MANAGEMENT (Admin Only)
// ============================================
router.get("/tutor-kyc", adminAuthorize, getAllKycSubmissions);
router.get("/tutor-kyc/stats", adminAuthorize, getKycStats);
router.get("/tutor-kyc/:id", adminAuthorize, getKycSubmissionById);
router.put("/tutor-kyc/:id/approve", adminAuthorize, approveKyc);
router.put("/tutor-kyc/:id/reject", adminAuthorize, rejectKyc);
router.put("/tutor-kyc/:id/request-resubmission", adminAuthorize, requestKycResubmission);

export default router;
