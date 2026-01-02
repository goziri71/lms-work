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
  getProfile,
  updateProfile,
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
router.get("/ebooks", authorize, browseEBooks);
router.get("/ebooks/my-ebooks", authorize, getStudentEBooks);
router.post("/ebooks/purchase", authorize, purchaseEBook);
router.post("/ebooks/:id/signed-url", authorize, getEBookSignedUrl);
router.get("/ebooks/:id", authorize, getStudentEBookById);

// ============================================
// TUTOR DASHBOARD ROUTES (Tutor Authentication Required)
// ============================================

// Dashboard
router.get("/tutor/dashboard", tutorAuthorize, getDashboard);

// Profile Management
router.get("/tutor/profile", tutorAuthorize, getProfile);
router.put("/tutor/profile", tutorAuthorize, updateProfile);

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

// E-Book Management (Tutor)
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

export default router;
