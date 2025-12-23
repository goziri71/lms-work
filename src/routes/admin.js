import express from "express";
import {
  adminLogin,
  adminLogout,
  getAdminProfile,
  updateAdminProfile,
  requestAdminPasswordReset,
  resetAdminPassword,
  changeAdminPassword,
} from "../controllers/admin/adminAuth.js";
import {
  getAllStudents,
  getStudentById,
  getStudentFullDetails,
  createStudent,
  updateStudent,
  deactivateStudent,
  activateStudent,
  resetStudentPassword,
  updateAdmissionStatus,
  updateGraduationStatus,
  getStudentStats,
} from "../controllers/admin/superAdmin/studentManagement.js";
import {
  getStudentKycDocuments,
  getStudentDocumentSignedUrl,
  getAllStudentsKycStatus,
  approveStudentDocument,
  rejectStudentDocument,
  getPendingDocuments,
  getFullyApprovedStudents,
} from "../controllers/admin/superAdmin/studentKycManagement.js";
import {
  getAllStaff,
  createStaff,
  updateStaff,
  deactivateStaff,
  resetStaffPassword,
} from "../controllers/admin/superAdmin/staffManagement.js";
import {
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deactivateAdmin,
  getAdminActivityLogs,
} from "../controllers/admin/superAdmin/adminManagement.js";
import {
  getAllPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
  getProgramStats,
} from "../controllers/admin/superAdmin/programManagement.js";
import {
  getAllCourses,
  getCoursesByProgram,
  getCourseById,
  createCourse,
  updateCourse,
  updateCoursePrice,
  deleteCourse,
  getCourseStats,
} from "../controllers/admin/superAdmin/courseManagement.js";
import {
  setCoursePrice,
  bulkSetCoursePrices,
  getCoursePrices,
  copyCoursePrices,
} from "../controllers/admin/superAdmin/coursePricingManagement.js";
import {
  allocateCourses,
  allocateCoursesToAllStudentsEndpoint,
  getAllocatedCourses,
  removeAllocation,
  bulkRemoveAllocations,
} from "../controllers/admin/superAdmin/courseAllocationManagement.js";
import {
  getAllSemesters,
  getSemesterById,
  getCurrentSemester,
  createSemester,
  updateSemester,
  closeSemester,
  extendSemester,
  activateSemester,
  deleteSemester,
  getSemesterStats,
  extendRegistrationDeadline,
} from "../controllers/admin/superAdmin/semesterManagement.js";
import {
  getAllFaculties,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  getFacultyStats,
} from "../controllers/admin/superAdmin/facultyManagement.js";
import {
  getSystemSettings,
  updateSystemSettings,
} from "../controllers/admin/superAdmin/settingsManagement.js";
import {
  getAllNotices,
  getNoticeById,
  createNotice,
  updateNotice,
  deleteNotice,
} from "../controllers/admin/superAdmin/noticeManagement.js";
import { getDashboardStats } from "../controllers/admin/superAdmin/dashboardController.js";
import {
  getAllFundings,
  getFundingStats,
  getAllSchoolFees,
  getSchoolFeesStats,
  getAllCourseOrders,
  getCourseOrderStats,
  getPaymentOverview,
  manageStudentWallet,
} from "../controllers/admin/superAdmin/paymentManagement.js";
import {
  setSchoolFeesConfiguration,
  getSchoolFeesConfigurations,
} from "../controllers/admin/superAdmin/schoolFeesManagement.js";
import {
  getAllPaymentSetup,
  getPaymentSetupById,
  createPaymentSetup,
  updatePaymentSetup,
  deletePaymentSetup,
  getPaymentSetupStats,
} from "../controllers/admin/superAdmin/paymentSetupManagement.js";
import {
  manuallyVerifyPayment,
  getPaymentTransaction,
} from "../controllers/admin/superAdmin/paymentVerification.js";
import {
  getAllSoleTutors,
  getSoleTutorById,
  approveSoleTutor,
  rejectSoleTutor,
  updateSoleTutorStatus,
  getAllOrganizations,
  getOrganizationById,
  approveOrganization,
  rejectOrganization,
  updateOrganizationStatus,
  getTutorStats,
  updateSoleTutorCommissionRate,
  updateOrganizationCommissionRate,
} from "../controllers/admin/superAdmin/tutorManagement.js";
import {
  getAllMarketplaceTransactions,
  getWspRevenueStatistics,
  getTutorRevenueDetails,
} from "../controllers/admin/superAdmin/revenueManagement.js";
import {
  adminAuthorize,
  requireSuperAdmin,
  requirePermission,
} from "../middlewares/adminAuthorize.js";

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication)
// ============================================
router.post("/login", adminLogin);
router.post("/password/reset-request", requestAdminPasswordReset);
router.post("/password/reset", resetAdminPassword);

// ============================================
// AUTHENTICATED ADMIN ROUTES
// ============================================
router.use(adminAuthorize); // All routes below require admin authentication

// Admin Profile
router.get("/profile", getAdminProfile);
router.put("/profile", updateAdminProfile);
router.post("/password/change", changeAdminPassword);
router.post("/logout", adminLogout);

// ============================================
// STUDENT MANAGEMENT
// ============================================
router.get("/students", getAllStudents);
router.get("/students/stats", getStudentStats);
router.get("/students/:id", getStudentById);
router.get("/students/:id/full", requireSuperAdmin, getStudentFullDetails);

// Student KYC Management
router.get("/students/kyc/status", getAllStudentsKycStatus);
router.get("/students/kyc/pending", getPendingDocuments);
router.get("/students/kyc/approved", getFullyApprovedStudents);
router.get("/students/:id/kyc", getStudentKycDocuments);
router.post("/students/:id/kyc/signed-url", getStudentDocumentSignedUrl);
router.put("/students/:id/kyc/documents/:document_type/approve", approveStudentDocument);
router.put("/students/:id/kyc/documents/:document_type/reject", rejectStudentDocument);

// Super Admin or permission required for modifications
router.post(
  "/students",
  requirePermission("students", "create"),
  createStudent
);
router.put(
  "/students/:id",
  requirePermission("students", "edit"),
  updateStudent
);
router.patch(
  "/students/:id/deactivate",
  requirePermission("students", "delete"),
  deactivateStudent
);
router.patch(
  "/students/:id/activate",
  requirePermission("students", "edit"),
  activateStudent
);
router.post(
  "/students/:id/reset-password",
  requirePermission("students", "edit"),
  resetStudentPassword
);
router.patch(
  "/students/:id/admission-status",
  requirePermission("students", "edit"),
  updateAdmissionStatus
);
router.patch(
  "/students/:id/graduation-status",
  requirePermission("students", "edit"),
  updateGraduationStatus
);

// ============================================
// STAFF MANAGEMENT
// ============================================
router.get("/staff", getAllStaff);
router.post("/staff", requirePermission("staff", "create"), createStaff);
router.put("/staff/:id", requirePermission("staff", "edit"), updateStaff);
router.patch(
  "/staff/:id/deactivate",
  requirePermission("staff", "delete"),
  deactivateStaff
);
router.post(
  "/staff/:id/reset-password",
  requirePermission("staff", "edit"),
  resetStaffPassword
);

// ============================================
// ADMIN MANAGEMENT (Super Admin Only)
// ============================================
router.get("/admins", requireSuperAdmin, getAllAdmins);
router.post("/admins", requireSuperAdmin, createAdmin);
router.put("/admins/:id", requireSuperAdmin, updateAdmin);
router.patch("/admins/:id/deactivate", requireSuperAdmin, deactivateAdmin);
router.get("/activity-logs", requireSuperAdmin, getAdminActivityLogs);

// ============================================
// PROGRAM MANAGEMENT (Super Admin Only)
// ============================================
router.get("/programs", requireSuperAdmin, getAllPrograms);
router.get("/programs/stats", requireSuperAdmin, getProgramStats);
router.get("/programs/:id", requireSuperAdmin, getProgramById);
router.post("/programs", requireSuperAdmin, createProgram);
router.put("/programs/:id", requireSuperAdmin, updateProgram);
router.delete("/programs/:id", requireSuperAdmin, deleteProgram);

// ============================================
// COURSE MANAGEMENT (Super Admin Only)
// ============================================
router.get("/courses", requireSuperAdmin, getAllCourses);
router.get("/courses/stats", requireSuperAdmin, getCourseStats);
router.get(
  "/courses/program/:programId",
  requireSuperAdmin,
  getCoursesByProgram
);

// ============================================
// COURSE PRICING MANAGEMENT (Super Admin Only)
// IMPORTANT: These routes must come BEFORE /courses/:id to avoid route conflicts
// ============================================
router.post("/courses/pricing", requireSuperAdmin, setCoursePrice);
router.post("/courses/pricing/bulk", requireSuperAdmin, bulkSetCoursePrices);
router.get("/courses/pricing", requireSuperAdmin, getCoursePrices);
router.post("/courses/pricing/copy", requireSuperAdmin, copyCoursePrices);

// ============================================
// COURSE ALLOCATION MANAGEMENT (Super Admin Only)
// IMPORTANT: These routes must come BEFORE /courses/:id to avoid route conflicts
// ============================================
router.post("/courses/allocate", requireSuperAdmin, allocateCourses);
router.post("/courses/allocate-all-students", requireSuperAdmin, allocateCoursesToAllStudentsEndpoint);
router.get("/courses/allocations", requireSuperAdmin, getAllocatedCourses);
router.delete("/courses/allocate/:id", requireSuperAdmin, removeAllocation);
router.delete(
  "/courses/allocate/bulk",
  requireSuperAdmin,
  bulkRemoveAllocations
);

// ============================================
// COURSE CRUD OPERATIONS (Must come AFTER specific routes)
// ============================================
router.get("/courses/:id", requireSuperAdmin, getCourseById);
router.post("/courses", requireSuperAdmin, createCourse);
router.put("/courses/:id/price", requireSuperAdmin, updateCoursePrice); // Must come before /courses/:id
router.put("/courses/:id", requireSuperAdmin, updateCourse);
router.delete("/courses/:id", requireSuperAdmin, deleteCourse);

// ============================================
// SEMESTER MANAGEMENT (Super Admin Only)
// ============================================
router.get("/semesters", requireSuperAdmin, getAllSemesters);
router.get("/semesters/current", requireSuperAdmin, getCurrentSemester);
router.get("/semesters/stats", requireSuperAdmin, getSemesterStats);
router.get("/semesters/:id", requireSuperAdmin, getSemesterById);
router.post("/semesters", requireSuperAdmin, createSemester);
router.put("/semesters/:id", requireSuperAdmin, updateSemester);
router.patch("/semesters/:id/close", requireSuperAdmin, closeSemester);
router.patch("/semesters/:id/extend", requireSuperAdmin, extendSemester);
router.patch("/semesters/:id/activate", requireSuperAdmin, activateSemester);
router.patch(
  "/semesters/:id/extend-deadline",
  requireSuperAdmin,
  extendRegistrationDeadline
);
router.delete("/semesters/:id", requireSuperAdmin, deleteSemester);

// ============================================
// FACULTY MANAGEMENT (Super Admin Only)
// ============================================
router.get("/faculties", requireSuperAdmin, getAllFaculties);
router.get("/faculties/stats", requireSuperAdmin, getFacultyStats);
router.get("/faculties/:id", requireSuperAdmin, getFacultyById);
router.post("/faculties", requireSuperAdmin, createFaculty);
router.put("/faculties/:id", requireSuperAdmin, updateFaculty);
router.delete("/faculties/:id", requireSuperAdmin, deleteFaculty);

// ============================================
// SYSTEM SETTINGS (Super Admin Only)
// ============================================
router.get("/settings", requireSuperAdmin, getSystemSettings);
router.put("/settings", requireSuperAdmin, updateSystemSettings);

// ============================================
// NOTICE MANAGEMENT (Super Admin Only)
// ============================================
router.get("/notices", requireSuperAdmin, getAllNotices);
router.get("/notices/:id", requireSuperAdmin, getNoticeById);
router.post("/notices", requireSuperAdmin, createNotice);
router.put("/notices/:id", requireSuperAdmin, updateNotice);
router.delete("/notices/:id", requireSuperAdmin, deleteNotice);

// ============================================
// PAYMENT MANAGEMENT (Super Admin Only)
// ============================================
router.get("/payments/overview", requireSuperAdmin, getPaymentOverview);
router.get("/payments/fundings", requireSuperAdmin, getAllFundings);
router.get("/payments/fundings/stats", requireSuperAdmin, getFundingStats);
router.get("/payments/school-fees", requireSuperAdmin, getAllSchoolFees);
router.get(
  "/payments/school-fees/stats",
  requireSuperAdmin,
  getSchoolFeesStats
);

// School Fees Configuration (Super Admin Only)
router.post(
  "/school-fees/configuration",
  requireSuperAdmin,
  setSchoolFeesConfiguration
);
router.get(
  "/school-fees/configuration",
  requireSuperAdmin,
  getSchoolFeesConfigurations
);

// Payment Setup Management (Super Admin Only)
router.get("/payment-setup", requireSuperAdmin, getAllPaymentSetup);
router.get("/payment-setup/stats", requireSuperAdmin, getPaymentSetupStats);
router.get("/payment-setup/:id", requireSuperAdmin, getPaymentSetupById);
router.post("/payment-setup", requireSuperAdmin, createPaymentSetup);
router.put("/payment-setup/:id", requireSuperAdmin, updatePaymentSetup);
router.delete("/payment-setup/:id", requireSuperAdmin, deletePaymentSetup);

// Payment Verification (Super Admin Only)
router.post(
  "/payments/verify",
  requireSuperAdmin,
  manuallyVerifyPayment
);
router.get(
  "/payments/transactions/:id",
  requireSuperAdmin,
  getPaymentTransaction
);
router.get("/payments/course-orders", requireSuperAdmin, getAllCourseOrders);
router.get(
  "/payments/course-orders/stats",
  requireSuperAdmin,
  getCourseOrderStats
);

// ============================================
// STUDENT WALLET MANAGEMENT (Super Admin Only)
// ============================================
router.post(
  "/students/:id/wallet/transaction",
  requireSuperAdmin,
  manageStudentWallet
);

// ============================================
// TUTOR MANAGEMENT (Super Admin Only)
// ============================================
// Sole Tutors
router.get("/tutors/sole-tutors", requireSuperAdmin, getAllSoleTutors);
router.get("/tutors/sole-tutors/:id", requireSuperAdmin, getSoleTutorById);
router.patch(
  "/tutors/sole-tutors/:id/approve",
  requireSuperAdmin,
  approveSoleTutor
);
router.patch(
  "/tutors/sole-tutors/:id/reject",
  requireSuperAdmin,
  rejectSoleTutor
);
router.patch(
  "/tutors/sole-tutors/:id/status",
  requireSuperAdmin,
  updateSoleTutorStatus
);
router.patch(
  "/tutors/sole-tutors/:id/commission-rate",
  requireSuperAdmin,
  updateSoleTutorCommissionRate
);

// Organizations
router.get("/tutors/organizations", requireSuperAdmin, getAllOrganizations);
router.get("/tutors/organizations/:id", requireSuperAdmin, getOrganizationById);
router.patch(
  "/tutors/organizations/:id/approve",
  requireSuperAdmin,
  approveOrganization
);
router.patch(
  "/tutors/organizations/:id/reject",
  requireSuperAdmin,
  rejectOrganization
);
router.patch(
  "/tutors/organizations/:id/status",
  requireSuperAdmin,
  updateOrganizationStatus
);
router.patch(
  "/tutors/organizations/:id/commission-rate",
  requireSuperAdmin,
  updateOrganizationCommissionRate
);

// Statistics
router.get("/tutors/stats", requireSuperAdmin, getTutorStats);

// ============================================
// REVENUE MANAGEMENT (Super Admin Only)
// ============================================
router.get(
  "/revenue/transactions",
  requireSuperAdmin,
  getAllMarketplaceTransactions
);
router.get("/revenue/wpu-stats", requireSuperAdmin, getWspRevenueStatistics);
router.get(
  "/revenue/tutor/:owner_type/:owner_id",
  requireSuperAdmin,
  getTutorRevenueDetails
);

// ============================================
// DASHBOARD & ANALYTICS (Super Admin Only)
// ============================================
router.get("/dashboard/stats", requireSuperAdmin, getDashboardStats);

export default router;
