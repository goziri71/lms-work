import express from "express";
import {
  registerSoleTutor,
  registerOrganization,
  soleTutorLogin,
  organizationLogin,
  organizationUserLogin,
  unifiedTutorLogin,
  requestPasswordResetSoleTutor,
  requestPasswordResetOrganization,
  requestPasswordResetTutor,
  resetPasswordSoleTutor,
  resetPasswordOrganization,
  tutorLogout,
} from "../controllers/marketplace/tutorAuth.js";
import { purchaseMarketplaceCourse } from "../controllers/marketplace/coursePurchase.js";
import { getMyMarketplaceCourses } from "../controllers/marketplace/myMarketplaceCourses.js";
import { browseMarketplaceCourses } from "../controllers/marketplace/browseMarketplaceCourses.js";
import { getAllTutors } from "../controllers/marketplace/getAllTutors.js";
import { getAllPrograms } from "../controllers/marketplace/getAllPrograms.js";
import { getCategories } from "../controllers/marketplace/categories.js";
import { authorize } from "../middlewares/authorize.js";
import { optionalAuthorize } from "../middlewares/optionalAuthorize.js";
import {
  tutorAuthorize,
  requireOrganization,
} from "../middlewares/tutorAuthorize.js";
import { getDashboard } from "../controllers/marketplace/tutorDashboard.js";
import {
  getMyCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  updateCourseStatus,
  uploadCourseImageMiddleware,
} from "../controllers/marketplace/tutorCourseManagement.js";
import {
  getEarningsSummary,
  getTransactions,
  getTransactionById,
} from "../controllers/marketplace/tutorEarnings.js";
import {
  getWalletBalance,
  fundWallet,
  getWalletTransactions,
} from "../controllers/marketplace/tutorWallet.js";
import {
  convertCurrency,
  getConversionRate,
  getConversionHistory,
} from "../controllers/marketplace/currencyConversion.js";
import {
  getProfile,
  updateProfile,
  changePassword,
  getSettings,
  updateSettings,
} from "../controllers/marketplace/tutorProfile.js";
import {
  getMyLearners,
  getLearnerDetails,
  getLearnerActivity,
  getLearnerCourseProgress,
} from "../controllers/marketplace/tutorLearnerManagement.js";
import {
  getOrganizationUsers,
  getOrganizationUserById,
  createOrganizationUser,
  updateOrganizationUser,
  deleteOrganizationUser,
  resetOrganizationUserPassword,
  getOrganizationUsersStats,
} from "../controllers/marketplace/organizationUserManagement.js";
import {
  getFaculties,
  getPrograms,
} from "../controllers/marketplace/tutorMetadata.js";
import {
  createModule,
  getModulesByCourse,
  updateModule,
  deleteModule,
  createUnit,
  getUnitsByModule,
  updateUnit,
  deleteUnit,
  uploadUnitVideo,
  uploadVideoMiddleware,
} from "../controllers/marketplace/tutorModuleManagement.js";
import {
  getMyEBooks as getTutorEBooks,
  getEBookById as getTutorEBookById,
  createEBook,
  updateEBook,
  deleteEBook,
  updateEBookStatus,
  uploadEBookPDF,
  uploadEBookCover,
  uploadPDFMiddleware,
  uploadCoverImageMiddleware,
} from "../controllers/marketplace/tutorEbookManagement.js";
import {
  browseEBooks,
  getEBookById as getStudentEBookById,
  getMyEBooks as getStudentEBooks,
} from "../controllers/marketplace/ebookBrowsing.js";
import { purchaseEBook } from "../controllers/marketplace/ebookPurchase.js";
import { getEBookSignedUrl } from "../controllers/marketplace/ebookAccess.js";
// Digital Downloads Controllers
import {
  getMyDigitalDownloads as getTutorDigitalDownloads,
  getDigitalDownloadById as getTutorDigitalDownloadById,
  createDigitalDownload,
  updateDigitalDownload,
  deleteDigitalDownload,
  updateDigitalDownloadStatus,
  uploadDigitalDownloadFile,
  uploadDigitalDownloadCover,
  uploadDigitalDownloadPreview,
  uploadDigitalDownloadFileMiddleware,
  uploadCoverImageMiddleware as uploadDigitalDownloadCoverMiddleware,
  uploadPreviewFileMiddleware,
} from "../controllers/marketplace/tutorDigitalDownloadManagement.js";
import {
  browseDigitalDownloads,
  getDigitalDownloadById as getStudentDigitalDownloadById,
  getMyDigitalDownloads as getStudentDigitalDownloads,
} from "../controllers/marketplace/digitalDownloadBrowsing.js";
import { purchaseDigitalDownload } from "../controllers/marketplace/digitalDownloadPurchase.js";
import {
  getDigitalDownloadUrl,
  getDigitalDownloadStreamUrl,
  getDigitalDownloadPreviewUrl,
} from "../controllers/marketplace/digitalDownloadAccess.js";
import { getProductBySlug } from "../controllers/public/productLink.js";
import {
  createReview,
  getProductReviews,
  markReviewHelpful,
  getMyReview,
} from "../controllers/marketplace/productReview.js";
import {
  addToCart,
  getCart,
  removeFromCart,
  updateCartItem,
  clearCart,
  mergeCart,
} from "../controllers/marketplace/storeCart.js";
import {
  browseStoreProducts,
  getStoreProduct,
} from "../controllers/marketplace/storeBrowsing.js";
import { initiateCheckout } from "../controllers/marketplace/storeCheckout.js";
import {
  getSalesPageBySlug,
  getSalesPageAnalytics,
} from "../controllers/public/salesPage.js";
import { getTutorProductsBySlug } from "../controllers/public/tutorPublicStore.js";
import {
  getFeaturedProducts,
  getTrendingProducts,
  getTopProducts,
} from "../controllers/marketplace/topProducts.js";
import {
  getDonationCategories,
  createDonation,
  getDonationWall,
  getMyDonations,
  getDonationStatistics,
} from "../controllers/marketplace/donation.js";
import {
  getNextOfKin,
  upsertNextOfKin,
  deleteNextOfKin,
} from "../controllers/marketplace/nextOfKin.js";
import {
  getKycStatus,
  submitKyc,
  uploadKycDocumentsMiddleware,
} from "../controllers/marketplace/tutorKyc.js";
import {
  initiateGoogleDriveConnection,
  handleGoogleDriveCallback,
  getGoogleDriveConnection,
  disconnectGoogleDrive,
  listGoogleDriveFiles,
  importGoogleDriveFiles,
  getImportedFiles,
  getExternalFile,
  deleteExternalFile,
} from "../controllers/marketplace/googleDrive.js";
import {
  createReadSession,
  updateReadProgress,
  getReadProgress,
  streamReadOnlyDocument,
  getMyReadSessions,
} from "../controllers/marketplace/readOnlyDownload.js";
import {
  getMyInvoices,
  getInvoice,
  downloadInvoice,
  sendInvoiceEmail,
} from "../controllers/marketplace/invoice.js";
import {
  getSubscription,
  subscribe,
  getSubscriptionLimits,
} from "../controllers/marketplace/tutorSubscription.js";
import {
  getHoursBalance,
  purchaseHours,
  getPurchaseHistory,
} from "../controllers/marketplace/coachingHours.js";
import {
  createSession,
  listSessions,
  getSession,
  inviteStudents,
  startSession,
  endSession,
  getJoinToken,
  cancelSession,
  uploadCoachingImageMiddleware,
} from "../controllers/marketplace/coachingSession.js";
import {
  browseSessions,
  getSessionDetails,
  getMySessions,
} from "../controllers/marketplace/coachingSessionBrowsing.js";
import { purchaseSessionAccess } from "../controllers/marketplace/coachingSessionPurchase.js";
import { getStudentJoinToken } from "../controllers/marketplace/coachingSession.js";
import {
  getSessionMessages,
  markMessagesAsRead,
} from "../controllers/marketplace/coachingMessaging.js";
import {
  createCommunity,
  getMyCommunities,
  getCommunity,
  updateCommunity,
  deleteCommunity,
  uploadCommunityImageMiddleware,
  uploadCommunityMediaMiddleware,
} from "../controllers/marketplace/communityManagement.js";
import { purchaseCommunitySubscription } from "../controllers/marketplace/communitySubscriptionPurchase.js";
import {
  getMySubscriptionForCommunity,
  getMyCommunities as getStudentMyCommunities,
  getCommunityMembers,
} from "../controllers/marketplace/studentCommunity.js";
import {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  createComment,
  getComments,
  uploadFile,
  getFiles,
  deleteFile,
  uploadCommunityFileMiddleware,
  uploadPostImageMiddleware,
} from "../controllers/marketplace/communityContent.js";
import {
  addReaction,
  getReactions,
} from "../controllers/marketplace/communityReactions.js";
import {
  createAudioSession,
  getTutorAudioSessions,
  getAudioSessions,
  getAudioSession,
  startAudioSession,
  endAudioSession,
  getJoinToken as getCommunityAudioJoinToken,
  cancelAudioSession,
} from "../controllers/marketplace/communityAudioSessions.js";
import {
  getMembers,
  getMember,
  updateMemberRole,
  blockMember,
  unblockMember,
  removeMember,
} from "../controllers/marketplace/communityMemberManagement.js";
import {
  getBanksList,
  addBankAccount,
  listBankAccounts,
  verifyAccount,
  updateBankAccount,
  setPrimaryAccount,
  deleteBankAccount,
} from "../controllers/marketplace/tutorBankAccount.js";
import {
  requestPayout,
  listPayouts,
  getPayout,
} from "../controllers/marketplace/tutorPayout.js";
import {
  createMembership,
  getMyMemberships,
  getMembership,
  updateMembership,
  addProductToMembership,
  removeProductFromMembership,
  deleteMembership,
  uploadMembershipImageMiddleware,
} from "../controllers/marketplace/membershipManagement.js";
import {
  createTier,
  getMembershipTiers,
  getTier,
  updateTier,
  deleteTier,
  bulkAssignProductsToTiers,
  addProductToTier,
  removeProductFromTier,
  parseTierFormMiddleware,
} from "../controllers/marketplace/membershipTierManagement.js";
import {
  browseMemberships,
  getMembershipDetails,
  getMembershipTiersForStudent,
  subscribeToMembership,
  cancelSubscription,
  getMySubscriptions,
  checkProductAccessEndpoint,
  changeTier,
} from "../controllers/marketplace/membershipSubscription.js";
import {
  createSalesPage,
  getSalesPage,
  getMySalesPages,
  updateSalesPage,
  deleteSalesPage,
  uploadHeroImage,
  uploadHeroVideo,
  uploadHeroImageMiddleware,
  uploadHeroVideoMiddleware,
} from "../controllers/marketplace/salesPageManagement.js";
import {
  generateAIContent,
  improveAIContent,
  summarizeAIContent,
  getContentTypes,
} from "../controllers/marketplace/aiContent.js";

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication)
// ============================================

// Public Product Link
router.get("/public/product/:slug", getProductBySlug);

// Public Store Browsing (No authentication required)
router.get("/store/products", browseStoreProducts);
router.get("/store/products/:type/:id", getStoreProduct);

// Public Sales Pages (No authentication required)
router.get("/public/sales/:slug", getSalesPageBySlug);

// Public Tutor Store - all products by sole tutor slug (No authentication required)
router.get("/public/tutor/:slug/products", getTutorProductsBySlug);

// Top Products (No authentication required)
router.get("/products/featured", getFeaturedProducts);
router.get("/products/trending", getTrendingProducts);
router.get("/products/top", getTopProducts);

// Donations (Public and authenticated)
router.get("/donations/categories", getDonationCategories); // Public
router.get("/donations/wall", getDonationWall); // Public
router.get("/donations/statistics", getDonationStatistics); // Public
router.post("/donations", optionalAuthorize, createDonation); // Optional auth (for anonymous donations)
router.get("/donations/my-donations", authorize, getMyDonations); // Requires auth

// Next of Kin (Tutor authenticated)
router.get("/next-of-kin", tutorAuthorize, getNextOfKin);
router.post("/next-of-kin", tutorAuthorize, upsertNextOfKin);
router.put("/next-of-kin", tutorAuthorize, upsertNextOfKin);
router.delete("/next-of-kin", tutorAuthorize, deleteNextOfKin);

// Tutor KYC (Sole tutor authenticated)
router.get("/tutor/kyc", tutorAuthorize, getKycStatus);
router.post(
  "/tutor/kyc",
  tutorAuthorize,
  uploadKycDocumentsMiddleware,
  submitKyc
);
router.put(
  "/tutor/kyc",
  tutorAuthorize,
  uploadKycDocumentsMiddleware,
  submitKyc
);

// Google Drive Integration (Tutor authenticated)
router.get(
  "/google-drive/connect",
  tutorAuthorize,
  initiateGoogleDriveConnection
);
router.get("/google-drive/callback", tutorAuthorize, handleGoogleDriveCallback);
router.get(
  "/google-drive/connection",
  tutorAuthorize,
  getGoogleDriveConnection
);
router.delete(
  "/google-drive/connection",
  tutorAuthorize,
  disconnectGoogleDrive
);
router.get("/google-drive/files", tutorAuthorize, listGoogleDriveFiles);
router.post("/google-drive/import", tutorAuthorize, importGoogleDriveFiles);
router.get("/google-drive/files/imported", tutorAuthorize, getImportedFiles);
router.get("/google-drive/files/:id", tutorAuthorize, getExternalFile);
router.delete("/google-drive/files/:id", tutorAuthorize, deleteExternalFile);

// Product Reviews (Student authentication required)
router.post("/reviews", authorize, createReview);
router.get("/reviews", authorize, getProductReviews);
router.get("/reviews/my-review", authorize, getMyReview);
router.post("/reviews/:id/helpful", authorize, markReviewHelpful);

// Registration
router.post("/register/sole-tutor", registerSoleTutor);
router.post("/register/organization", registerOrganization);

// Login
// Unified login - auto-detects sole tutor or organization
router.post("/login", unifiedTutorLogin);
// Separate login endpoints (kept for backward compatibility)
router.post("/login/sole-tutor", soleTutorLogin);
router.post("/login/organization", organizationLogin);
router.post("/login/organization-user", organizationUserLogin);

// Password Reset
// Unified: one endpoint for both sole tutor and organization (recommended for "Forgot password" form)
router.post("/password/reset-request", requestPasswordResetTutor);
router.post("/password/reset/request", requestPasswordResetTutor);
// Legacy: type-specific endpoints (still supported)
router.post(
  "/password/reset-request/sole-tutor",
  requestPasswordResetSoleTutor
);
router.post(
  "/password/reset/request/sole-tutor",
  requestPasswordResetSoleTutor
);
router.post(
  "/password/reset-request/organization",
  requestPasswordResetOrganization
);
router.post(
  "/password/reset/request/organization",
  requestPasswordResetOrganization
);
router.post("/password/reset/sole-tutor", resetPasswordSoleTutor);
router.post("/password/reset/organization", resetPasswordOrganization);

// Logout (requires tutor authentication)
router.post("/logout", tutorAuthorize, tutorLogout);

// Get all tutors/organizations (for filtering marketplace courses)
// Public endpoint - accessible to all (students can use for filtering)
router.get("/tutors", getAllTutors);

// Get all programs (for filtering marketplace courses)
// Public endpoint - accessible to all (students can use for filtering)
router.get("/programs", getAllPrograms);

// ============================================
// AUTHENTICATED ROUTES
// ============================================
// IMPORTANT: More specific routes must come first (Express matches in order)
// Get My Marketplace Courses (Student only - lifetime access courses)
router.get("/courses/my-courses", authorize, getMyMarketplaceCourses);

// Categories endpoint (public - no auth required)
router.get("/categories", getCategories);

// Course Purchase (Student only)
router.post("/courses/purchase", authorize, purchaseMarketplaceCourse);

// Browse all marketplace courses (Student only - shows available courses to purchase)
// This must come last because it's less specific than /courses/my-courses
router.get("/courses", authorize, browseMarketplaceCourses);

// E-Book Browsing & Purchase (Student)
// IMPORTANT: More specific routes must come before parameterized routes
// E-Books (Legacy - kept for backward compatibility)
router.get("/ebooks", authorize, browseEBooks);
router.get("/ebooks/my-ebooks", authorize, getStudentEBooks);
router.post("/ebooks/purchase", authorize, purchaseEBook);
router.post("/ebooks/:id/signed-url", authorize, getEBookSignedUrl);
router.get("/ebooks/:id", authorize, getStudentEBookById);

// Digital Downloads (New - supports all product types)
router.get("/digital-downloads", authorize, browseDigitalDownloads);
router.get(
  "/digital-downloads/my-downloads",
  authorize,
  getStudentDigitalDownloads
);
router.post("/digital-downloads/purchase", authorize, purchaseDigitalDownload);
router.post(
  "/digital-downloads/:id/download-url",
  authorize,
  getDigitalDownloadUrl
);
router.post(
  "/digital-downloads/:id/stream-url",
  authorize,
  getDigitalDownloadStreamUrl
);
router.get("/digital-downloads/:id/preview-url", getDigitalDownloadPreviewUrl);
router.get("/digital-downloads/:id", authorize, getStudentDigitalDownloadById);

// Read-Only Digital Downloads
router.post(
  "/digital-downloads/:id/read-session",
  authorize,
  createReadSession
);
router.put(
  "/digital-downloads/:id/read-session",
  authorize,
  updateReadProgress
);
router.get("/digital-downloads/:id/read-session", authorize, getReadProgress);
router.get("/digital-downloads/:id/read", streamReadOnlyDocument); // Public endpoint with token
router.get("/read-sessions", authorize, getMyReadSessions);

// ============================================
// INVOICE ROUTES (Student Authentication Required)
// ============================================
router.get("/invoices", authorize, getMyInvoices);
router.get("/invoices/:id", authorize, getInvoice);
router.get("/invoices/:id/download", authorize, downloadInvoice);
router.post("/invoices/:id/send", authorize, sendInvoiceEmail);

// ============================================
// TUTOR DASHBOARD ROUTES (Tutor Authentication Required)
// ============================================

// Dashboard
router.get("/tutor/dashboard", tutorAuthorize, getDashboard);

// Profile Management
router.get("/tutor/profile", tutorAuthorize, getProfile);
router.put("/tutor/profile", tutorAuthorize, updateProfile);
router.put("/tutor/change-password", tutorAuthorize, changePassword);

// Settings Management
router.get("/tutor/settings", tutorAuthorize, getSettings);
router.put("/tutor/settings", tutorAuthorize, updateSettings);

// Course Management
router.get("/tutor/courses", tutorAuthorize, getMyCourses);
router.get("/tutor/courses/:id", tutorAuthorize, getCourseById);
router.post(
  "/tutor/courses",
  tutorAuthorize,
  uploadCourseImageMiddleware,
  createCourse
);
router.put(
  "/tutor/courses/:id",
  tutorAuthorize,
  uploadCourseImageMiddleware,
  updateCourse
);
router.delete("/tutor/courses/:id", tutorAuthorize, deleteCourse);
router.patch("/tutor/courses/:id/status", tutorAuthorize, updateCourseStatus);

// Earnings & Wallet
router.get("/tutor/earnings/summary", tutorAuthorize, getEarningsSummary);
router.get("/tutor/earnings/transactions", tutorAuthorize, getTransactions);
router.get(
  "/tutor/earnings/transactions/:id",
  tutorAuthorize,
  getTransactionById
);

// Wallet Management
router.get("/tutor/wallet", tutorAuthorize, getWalletBalance); // General wallet endpoint
router.get("/tutor/wallet/balance", tutorAuthorize, getWalletBalance); // Alias
router.post("/tutor/wallet/fund", tutorAuthorize, fundWallet);
router.get("/tutor/wallet/transactions", tutorAuthorize, getWalletTransactions);

// Currency Conversion
router.post("/tutor/wallet/convert", tutorAuthorize, convertCurrency);
router.get("/tutor/wallet/convert/rate", tutorAuthorize, getConversionRate);
router.get(
  "/tutor/wallet/convert/history",
  tutorAuthorize,
  getConversionHistory
);

// Metadata (Faculties & Programs for course creation)
router.get("/tutor/faculties", tutorAuthorize, getFaculties);
router.get("/tutor/programs", tutorAuthorize, getPrograms);

// Course Module & Unit Management
router.post("/tutor/courses/:courseId/modules", tutorAuthorize, createModule);
router.get(
  "/tutor/courses/:courseId/modules",
  tutorAuthorize,
  getModulesByCourse
);
router.patch("/tutor/modules/:moduleId", tutorAuthorize, updateModule);
router.delete("/tutor/modules/:moduleId", tutorAuthorize, deleteModule);
router.post("/tutor/modules/:moduleId/units", tutorAuthorize, createUnit);
router.get("/tutor/modules/:moduleId/units", tutorAuthorize, getUnitsByModule);
router.patch("/tutor/units/:unitId", tutorAuthorize, updateUnit);
router.delete("/tutor/units/:unitId", tutorAuthorize, deleteUnit);
router.post(
  "/tutor/modules/:moduleId/units/:unitId/video",
  tutorAuthorize,
  uploadVideoMiddleware,
  uploadUnitVideo
);

// E-Book Management (Tutor) - Legacy (kept for backward compatibility)
router.get("/tutor/ebooks", tutorAuthorize, getTutorEBooks);
router.get("/tutor/ebooks/:id", tutorAuthorize, getTutorEBookById);
router.post("/tutor/ebooks", tutorAuthorize, createEBook);
router.put("/tutor/ebooks/:id", tutorAuthorize, updateEBook);
router.delete("/tutor/ebooks/:id", tutorAuthorize, deleteEBook);
router.patch("/tutor/ebooks/:id/status", tutorAuthorize, updateEBookStatus);
router.post(
  "/tutor/ebooks/upload-pdf",
  tutorAuthorize,
  uploadPDFMiddleware,
  uploadEBookPDF
);
router.post(
  "/tutor/ebooks/upload-cover",
  tutorAuthorize,
  uploadCoverImageMiddleware,
  uploadEBookCover
);

// Digital Downloads Management (Tutor) - New (supports all product types)
router.get(
  "/tutor/digital-downloads",
  tutorAuthorize,
  getTutorDigitalDownloads
);
router.get(
  "/tutor/digital-downloads/:id",
  tutorAuthorize,
  getTutorDigitalDownloadById
);
router.post("/tutor/digital-downloads", tutorAuthorize, createDigitalDownload);
router.put(
  "/tutor/digital-downloads/:id",
  tutorAuthorize,
  updateDigitalDownload
);
router.delete(
  "/tutor/digital-downloads/:id",
  tutorAuthorize,
  deleteDigitalDownload
);
router.patch(
  "/tutor/digital-downloads/:id/status",
  tutorAuthorize,
  updateDigitalDownloadStatus
);
router.post(
  "/tutor/digital-downloads/upload-file",
  tutorAuthorize,
  uploadDigitalDownloadFileMiddleware,
  uploadDigitalDownloadFile
);
router.post(
  "/tutor/digital-downloads/upload-cover",
  tutorAuthorize,
  uploadDigitalDownloadCoverMiddleware,
  uploadDigitalDownloadCover
);
router.post(
  "/tutor/digital-downloads/upload-preview",
  tutorAuthorize,
  uploadPreviewFileMiddleware,
  uploadDigitalDownloadPreview
);

// ============================================
// ORGANIZATION USER MANAGEMENT (Organization Account Only)
// ============================================
router.get(
  "/tutor/organization/users",
  tutorAuthorize,
  requireOrganization,
  getOrganizationUsers
);
router.get(
  "/tutor/organization/users/stats",
  tutorAuthorize,
  requireOrganization,
  getOrganizationUsersStats
);
router.get(
  "/tutor/organization/users/:id",
  tutorAuthorize,
  requireOrganization,
  getOrganizationUserById
);
router.post(
  "/tutor/organization/users",
  tutorAuthorize,
  requireOrganization,
  createOrganizationUser
);
router.put(
  "/tutor/organization/users/:id",
  tutorAuthorize,
  requireOrganization,
  updateOrganizationUser
);
router.delete(
  "/tutor/organization/users/:id",
  tutorAuthorize,
  requireOrganization,
  deleteOrganizationUser
);
router.post(
  "/tutor/organization/users/:id/reset-password",
  tutorAuthorize,
  requireOrganization,
  resetOrganizationUserPassword
);

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================
router.get("/tutor/subscription", tutorAuthorize, getSubscription);
router.post("/tutor/subscription", tutorAuthorize, subscribe);
router.get("/tutor/subscription/limits", tutorAuthorize, getSubscriptionLimits);

// ============================================
// COACHING HOURS MANAGEMENT
// ============================================
router.get("/tutor/coaching/hours-balance", tutorAuthorize, getHoursBalance);
router.post("/tutor/coaching/purchase-hours", tutorAuthorize, purchaseHours);
router.get(
  "/tutor/coaching/purchase-history",
  tutorAuthorize,
  getPurchaseHistory
);

// ============================================
// COACHING SESSIONS MANAGEMENT
// ============================================
router.post(
  "/tutor/coaching/sessions",
  tutorAuthorize,
  uploadCoachingImageMiddleware,
  createSession
);
router.get("/tutor/coaching/sessions", tutorAuthorize, listSessions);
router.get("/tutor/coaching/sessions/:id", tutorAuthorize, getSession);
router.post(
  "/tutor/coaching/sessions/:id/invite",
  tutorAuthorize,
  inviteStudents
);
router.post("/tutor/coaching/sessions/:id/start", tutorAuthorize, startSession);
router.post("/tutor/coaching/sessions/:id/end", tutorAuthorize, endSession);
router.post("/tutor/coaching/sessions/:id/token", tutorAuthorize, getJoinToken);
router.delete("/tutor/coaching/sessions/:id", tutorAuthorize, cancelSession);

// ============================================
// STUDENT COACHING SESSION ENDPOINTS
// ============================================
// Browse sessions - optional auth (public can browse, authenticated students see purchase status)
router.get("/coaching/sessions", optionalAuthorize, browseSessions);
router.get("/coaching/sessions/:id", optionalAuthorize, getSessionDetails);
// Purchase and join - require student authentication
router.post(
  "/coaching/sessions/:id/purchase",
  authorize,
  purchaseSessionAccess
);
router.post(
  "/coaching/sessions/:id/join-token",
  authorize,
  getStudentJoinToken
);
router.get("/coaching/my-sessions", authorize, getMySessions);

// COACHING MESSAGING (One-on-One Scheduling)
router.get(
  "/coaching/sessions/:sessionId/messages",
  authorize,
  getSessionMessages
);
router.put(
  "/coaching/sessions/:sessionId/messages/read",
  authorize,
  markMessagesAsRead
);

// COMMUNITY MANAGEMENT
router.post(
  "/tutor/communities",
  tutorAuthorize,
  uploadCommunityMediaMiddleware,
  createCommunity
);
router.get("/tutor/communities", tutorAuthorize, getMyCommunities);
router.get("/tutor/communities/:id", tutorAuthorize, getCommunity);
router.put(
  "/tutor/communities/:id",
  tutorAuthorize,
  uploadCommunityImageMiddleware,
  updateCommunity
);
router.delete("/tutor/communities/:id", tutorAuthorize, deleteCommunity);

// COMMUNITY SUBSCRIPTION PURCHASE
router.post(
  "/communities/:id/subscribe",
  authorize,
  purchaseCommunitySubscription
);

// STUDENT: My subscription status for a community & list my communities
router.get(
  "/communities/:id/subscription",
  authorize,
  getMySubscriptionForCommunity
);
router.get("/my-communities", authorize, getStudentMyCommunities);
router.get("/communities/:id/members", authorize, getCommunityMembers);

// COMMUNITY CONTENT (Posts, Comments, Files)
router.post(
  "/communities/:id/posts",
  authorize,
  uploadPostImageMiddleware,
  createPost
);
router.get("/communities/:id/posts", optionalAuthorize, getPosts);
router.get("/communities/:id/posts/:postId", optionalAuthorize, getPost);
router.put(
  "/communities/:id/posts/:postId",
  authorize,
  uploadPostImageMiddleware,
  updatePost
);
router.delete("/communities/:id/posts/:postId", authorize, deletePost);
router.post(
  "/communities/:id/posts/:postId/comments",
  authorize,
  createComment
);
router.get(
  "/communities/:id/posts/:postId/comments",
  optionalAuthorize,
  getComments
);
router.post(
  "/communities/:id/files",
  authorize,
  uploadCommunityFileMiddleware,
  uploadFile
);
router.get("/communities/:id/files", authorize, getFiles);
router.delete("/communities/:id/files/:fileId", authorize, deleteFile);

// COMMUNITY REACTIONS
router.post("/communities/:id/reactions", authorize, addReaction);
router.get("/communities/:id/reactions", optionalAuthorize, getReactions);

// COMMUNITY AUDIO SESSIONS
router.post(
  "/tutor/communities/:id/audio-sessions",
  tutorAuthorize,
  createAudioSession
);
router.get(
  "/tutor/communities/:id/audio-sessions",
  tutorAuthorize,
  getTutorAudioSessions
);
router.get(
  "/communities/:id/audio-sessions",
  optionalAuthorize,
  getAudioSessions
);
router.get(
  "/communities/:id/audio-sessions/:sessionId",
  optionalAuthorize,
  getAudioSession
);
router.post(
  "/tutor/communities/:id/audio-sessions/:sessionId/start",
  tutorAuthorize,
  startAudioSession
);
router.post(
  "/tutor/communities/:id/audio-sessions/:sessionId/end",
  tutorAuthorize,
  endAudioSession
);
router.post(
  "/communities/:id/audio-sessions/:sessionId/join-token",
  authorize,
  getCommunityAudioJoinToken
);
router.delete(
  "/tutor/communities/:id/audio-sessions/:sessionId",
  tutorAuthorize,
  cancelAudioSession
);

// COMMUNITY MEMBER MANAGEMENT
router.get("/tutor/communities/:id/members", tutorAuthorize, getMembers);
router.get(
  "/tutor/communities/:id/members/:memberId",
  tutorAuthorize,
  getMember
);
router.put(
  "/tutor/communities/:id/members/:memberId/role",
  tutorAuthorize,
  updateMemberRole
);
router.put(
  "/tutor/communities/:id/members/:memberId/block",
  tutorAuthorize,
  blockMember
);
router.put(
  "/tutor/communities/:id/members/:memberId/unblock",
  tutorAuthorize,
  unblockMember
);
router.delete(
  "/tutor/communities/:id/members/:memberId",
  tutorAuthorize,
  removeMember
);

// ============================================
// TUTOR BANK ACCOUNT MANAGEMENT
// ============================================
router.get("/tutor/bank-accounts/banks", tutorAuthorize, getBanksList);
router.post("/tutor/bank-accounts", tutorAuthorize, addBankAccount);
router.get("/tutor/bank-accounts", tutorAuthorize, listBankAccounts);
router.post("/tutor/bank-accounts/:id/verify", tutorAuthorize, verifyAccount);
router.put(
  "/tutor/bank-accounts/:id/set-primary",
  tutorAuthorize,
  setPrimaryAccount
);
router.put("/tutor/bank-accounts/:id", tutorAuthorize, updateBankAccount);
router.delete("/tutor/bank-accounts/:id", tutorAuthorize, deleteBankAccount);

// ============================================
// TUTOR PAYOUT MANAGEMENT
// ============================================
router.post("/tutor/payouts/request", tutorAuthorize, requestPayout);
router.get("/tutor/payouts", tutorAuthorize, listPayouts);

// ============================================
// MEMBERSHIP MANAGEMENT (TUTOR)
// ============================================
router.post(
  "/tutor/memberships",
  tutorAuthorize,
  uploadMembershipImageMiddleware,
  createMembership
);
router.get("/tutor/memberships", tutorAuthorize, getMyMemberships);
router.get("/tutor/memberships/:id", tutorAuthorize, getMembership);
router.put(
  "/tutor/memberships/:id",
  tutorAuthorize,
  uploadMembershipImageMiddleware,
  updateMembership
);
router.post(
  "/tutor/memberships/:id/products",
  tutorAuthorize,
  addProductToMembership
);
router.delete(
  "/tutor/memberships/:id/products/:productId",
  tutorAuthorize,
  removeProductFromMembership
);
router.delete("/tutor/memberships/:id", tutorAuthorize, deleteMembership);

// ============================================
// MEMBERSHIP TIER MANAGEMENT (TUTOR)
// ============================================
router.post("/tutor/memberships/:id/tiers", tutorAuthorize, createTier);
router.get("/tutor/memberships/:id/tiers", tutorAuthorize, getMembershipTiers);
router.get("/tutor/memberships/:id/tiers/:tierId", tutorAuthorize, getTier);
router.put(
  "/tutor/memberships/:id/tiers/:tierId",
  tutorAuthorize,
  parseTierFormMiddleware,
  updateTier
);
router.delete(
  "/tutor/memberships/:id/tiers/:tierId",
  tutorAuthorize,
  deleteTier
);
router.post(
  "/tutor/memberships/:id/tiers/products",
  tutorAuthorize,
  bulkAssignProductsToTiers
);
router.post(
  "/tutor/memberships/:id/tiers/:tierId/products",
  tutorAuthorize,
  addProductToTier
);
router.delete(
  "/tutor/memberships/:id/tiers/:tierId/products/:productId",
  tutorAuthorize,
  removeProductFromTier
);

// ============================================
// MEMBERSHIP SUBSCRIPTION (LEARNER)
// ============================================
router.get("/memberships", authorize, browseMemberships);
router.get("/memberships/my-subscriptions", authorize, getMySubscriptions); // Must be before /:id
router.get("/memberships/:id/tiers", authorize, getMembershipTiersForStudent);
router.get("/memberships/:id", authorize, getMembershipDetails);
router.post("/memberships/:id/subscribe", authorize, subscribeToMembership);
router.post("/memberships/:id/change-tier", authorize, changeTier);
router.post("/memberships/:id/cancel", authorize, cancelSubscription);
router.get(
  "/products/:productType/:productId/access",
  authorize,
  checkProductAccessEndpoint
);

// Store Cart Management (Student authentication optional for guest carts)
router.post("/store/cart/add", optionalAuthorize, addToCart);
router.get("/store/cart", optionalAuthorize, getCart);
router.put("/store/cart/item/:id", optionalAuthorize, updateCartItem);
router.delete("/store/cart/item/:id", optionalAuthorize, removeFromCart);
router.delete("/store/cart", optionalAuthorize, clearCart);
router.post("/store/cart/merge", authorize, mergeCart); // Requires auth to merge guest cart

// Store Checkout
router.post("/store/checkout", optionalAuthorize, initiateCheckout);

// ============================================
// SALES PAGE MANAGEMENT (TUTOR)
// ============================================
// Sales Page File Uploads (must come before /tutor/sales-pages/:id routes)
router.post(
  "/tutor/sales-pages/upload-hero-image",
  tutorAuthorize,
  uploadHeroImageMiddleware,
  uploadHeroImage
);
router.post(
  "/tutor/sales-pages/upload-hero-video",
  tutorAuthorize,
  uploadHeroVideoMiddleware,
  uploadHeroVideo
);

// Sales Page CRUD
router.post("/tutor/sales-pages", tutorAuthorize, createSalesPage);
router.get("/tutor/sales-pages", tutorAuthorize, getMySalesPages);
router.get("/tutor/sales-pages/:id", tutorAuthorize, getSalesPage);
router.put("/tutor/sales-pages/:id", tutorAuthorize, updateSalesPage);
router.delete("/tutor/sales-pages/:id", tutorAuthorize, deleteSalesPage);
router.get(
  "/tutor/sales-pages/:id/analytics",
  tutorAuthorize,
  getSalesPageAnalytics
);

router.get("/tutor/payouts/:id", tutorAuthorize, getPayout);

// ============================================
// AI CONTENT GENERATION (Tutor Authentication Required)
// ============================================
router.get("/tutor/ai/content-types", tutorAuthorize, getContentTypes);
router.post("/tutor/ai/generate", tutorAuthorize, generateAIContent);
router.post("/tutor/ai/improve", tutorAuthorize, improveAIContent);
router.post("/tutor/ai/summarize", tutorAuthorize, summarizeAIContent);

// Learner Management & Activity Tracking
router.get("/tutor/learners", tutorAuthorize, getMyLearners);
router.get("/tutor/learners/:learnerId", tutorAuthorize, getLearnerDetails);
router.get(
  "/tutor/learners/:learnerId/activity",
  tutorAuthorize,
  getLearnerActivity
);
router.get(
  "/tutor/learners/:learnerId/courses/:courseId/progress",
  tutorAuthorize,
  getLearnerCourseProgress
);

export default router;
