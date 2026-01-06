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
  resetPasswordSoleTutor,
  resetPasswordOrganization,
  tutorLogout,
} from "../controllers/marketplace/tutorAuth.js";
import { purchaseMarketplaceCourse } from "../controllers/marketplace/coursePurchase.js";
import { getMyMarketplaceCourses } from "../controllers/marketplace/myMarketplaceCourses.js";
import { browseMarketplaceCourses } from "../controllers/marketplace/browseMarketplaceCourses.js";
import { getAllTutors } from "../controllers/marketplace/getAllTutors.js";
import { getAllPrograms } from "../controllers/marketplace/getAllPrograms.js";
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
  getProfile,
  updateProfile,
  changePassword,
  getSettings,
  updateSettings,
} from "../controllers/marketplace/tutorProfile.js";
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

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication)
// ============================================

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
router.post(
  "/password/reset-request/sole-tutor",
  requestPasswordResetSoleTutor
);
router.post(
  "/password/reset-request/organization",
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
router.get("/tutor/wallet/balance", tutorAuthorize, getWalletBalance);
router.post("/tutor/wallet/fund", tutorAuthorize, fundWallet);
router.get("/tutor/wallet/transactions", tutorAuthorize, getWalletTransactions);

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
import {
  getSubscription,
  subscribe,
  getSubscriptionLimits,
} from "../controllers/marketplace/tutorSubscription.js";

router.get("/tutor/subscription", tutorAuthorize, getSubscription);
router.post("/tutor/subscription", tutorAuthorize, subscribe);
router.get("/tutor/subscription/limits", tutorAuthorize, getSubscriptionLimits);

// ============================================
// COACHING HOURS MANAGEMENT
// ============================================
import {
  getHoursBalance,
  purchaseHours,
  getPurchaseHistory,
} from "../controllers/marketplace/coachingHours.js";

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
import {
  browseSessions,
  getSessionDetails,
  getMySessions,
} from "../controllers/marketplace/coachingSessionBrowsing.js";
import { purchaseSessionAccess } from "../controllers/marketplace/coachingSessionPurchase.js";
import { getStudentJoinToken } from "../controllers/marketplace/coachingSession.js";

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
import {
  getSessionMessages,
  markMessagesAsRead,
} from "../controllers/marketplace/coachingMessaging.js";

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
import {
  createCommunity,
  getMyCommunities,
  getCommunity,
  updateCommunity,
  deleteCommunity,
  uploadCommunityImageMiddleware,
} from "../controllers/marketplace/communityManagement.js";

router.post(
  "/tutor/communities",
  tutorAuthorize,
  uploadCommunityImageMiddleware,
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
import { purchaseCommunitySubscription } from "../controllers/marketplace/communitySubscriptionPurchase.js";

router.post(
  "/communities/:id/subscribe",
  authorize,
  purchaseCommunitySubscription
);

// COMMUNITY CONTENT (Posts, Comments, Files)
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
} from "../controllers/marketplace/communityContent.js";

router.post("/communities/:id/posts", authorize, createPost);
router.get("/communities/:id/posts", optionalAuthorize, getPosts);
router.get("/communities/:id/posts/:postId", optionalAuthorize, getPost);
router.put("/communities/:id/posts/:postId", authorize, updatePost);
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

// COMMUNITY AUDIO SESSIONS
import {
  createAudioSession,
  getAudioSessions,
  getAudioSession,
  startAudioSession,
  endAudioSession,
  getJoinToken as getCommunityAudioJoinToken,
  cancelAudioSession,
} from "../controllers/marketplace/communityAudioSessions.js";

router.post(
  "/tutor/communities/:id/audio-sessions",
  tutorAuthorize,
  createAudioSession
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
import {
  getMembers,
  getMember,
  updateMemberRole,
  blockMember,
  unblockMember,
  removeMember,
} from "../controllers/marketplace/communityMemberManagement.js";

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
import {
  getBanksList,
  addBankAccount,
  listBankAccounts,
  verifyAccount,
  setPrimaryAccount,
  deleteBankAccount,
} from "../controllers/marketplace/tutorBankAccount.js";

router.get("/tutor/bank-accounts/banks", tutorAuthorize, getBanksList);
router.post("/tutor/bank-accounts", tutorAuthorize, addBankAccount);
router.get("/tutor/bank-accounts", tutorAuthorize, listBankAccounts);
router.post("/tutor/bank-accounts/:id/verify", tutorAuthorize, verifyAccount);
router.put(
  "/tutor/bank-accounts/:id/set-primary",
  tutorAuthorize,
  setPrimaryAccount
);
router.delete("/tutor/bank-accounts/:id", tutorAuthorize, deleteBankAccount);

// ============================================
// TUTOR PAYOUT MANAGEMENT
// ============================================
import {
  requestPayout,
  listPayouts,
  getPayout,
} from "../controllers/marketplace/tutorPayout.js";

router.post("/tutor/payouts/request", tutorAuthorize, requestPayout);
router.get("/tutor/payouts", tutorAuthorize, listPayouts);
router.get("/tutor/payouts/:id", tutorAuthorize, getPayout);

export default router;
