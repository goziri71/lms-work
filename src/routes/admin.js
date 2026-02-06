/**
 * Admin Routes
 * Routes for admin operations (including fund transfers and all super admin operations)
 */

import express from "express";
import {
  adminAuthorize,
  requireSuperAdmin,
} from "../middlewares/adminAuthorize.js";
import {
  adminLogin,
  adminLogout,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  requestAdminPasswordReset,
  resetAdminPassword,
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

// Super Admin Controllers
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
  uploadCourseImageMiddleware,
} from "../controllers/admin/superAdmin/courseManagement.js";

import {
  getAllSemesters,
  getSemesterById,
  getCurrentSemester,
  createSemester,
  updateSemester,
  closeSemester,
  extendSemester,
  activateSemester,
  extendRegistrationDeadline,
  deleteSemester,
  getSemesterStats,
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
  getAllNotices,
  getNoticeById,
  createNotice,
  updateNotice,
  deleteNotice,
} from "../controllers/admin/superAdmin/noticeManagement.js";

import {
  allocateCourses,
  allocateCoursesToAllStudentsEndpoint,
  getAllocatedCourses,
  removeAllocation,
  bulkRemoveAllocations,
} from "../controllers/admin/superAdmin/courseAllocationManagement.js";

import {
  setCoursePrice,
  bulkSetCoursePrices,
  getCoursePrices,
  copyCoursePrices,
} from "../controllers/admin/superAdmin/coursePricingManagement.js";

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
  getDashboardStats,
} from "../controllers/admin/superAdmin/dashboardController.js";

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
  updateSoleTutorCommissionRate,
  updateOrganizationCommissionRate,
  getTutorStats,
} from "../controllers/admin/superAdmin/tutorManagement.js";

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
  getSystemSettings,
  updateSystemSettings,
} from "../controllers/admin/superAdmin/settingsManagement.js";

import {
  getAllMarketplaceTransactions,
  getWspRevenueStatistics,
  getTutorRevenueDetails,
} from "../controllers/admin/superAdmin/revenueManagement.js";

const router = express.Router();

// ============================================
// ADMIN AUTHENTICATION (Public - No auth required)
// ============================================
router.post("/login", adminLogin);
router.post("/logout", adminAuthorize, adminLogout);
router.get("/profile", adminAuthorize, getAdminProfile);
router.put("/profile", adminAuthorize, updateAdminProfile);
router.put("/change-password", adminAuthorize, changeAdminPassword);
router.post("/password/reset-request", requestAdminPasswordReset);
router.post("/password/reset", resetAdminPassword);

// ============================================
// DASHBOARD (Super Admin Only)
// ============================================
router.get("/dashboard/stats", adminAuthorize, requireSuperAdmin, getDashboardStats);
router.get("/dashboard", adminAuthorize, requireSuperAdmin, getDashboardStats); // Alias for backward compatibility

// ============================================
// STUDENT MANAGEMENT (Super Admin Only)
// ============================================
router.get("/students", adminAuthorize, requireSuperAdmin, getAllStudents);
router.get("/students/stats", adminAuthorize, requireSuperAdmin, getStudentStats);
router.get("/students/:id", adminAuthorize, requireSuperAdmin, getStudentById);
router.get("/students/:id/full", adminAuthorize, requireSuperAdmin, getStudentFullDetails);
router.post("/students", adminAuthorize, requireSuperAdmin, createStudent);
router.put("/students/:id", adminAuthorize, requireSuperAdmin, updateStudent);
router.patch("/students/:id/deactivate", adminAuthorize, requireSuperAdmin, deactivateStudent);
router.patch("/students/:id/activate", adminAuthorize, requireSuperAdmin, activateStudent);
router.post("/students/:id/reset-password", adminAuthorize, requireSuperAdmin, resetStudentPassword);
router.put("/students/:id/admission-status", adminAuthorize, requireSuperAdmin, updateAdmissionStatus);
router.put("/students/:id/graduation-status", adminAuthorize, requireSuperAdmin, updateGraduationStatus);

// ============================================
// STAFF MANAGEMENT (Super Admin Only)
// ============================================
router.get("/staff", adminAuthorize, requireSuperAdmin, getAllStaff);
router.post("/staff", adminAuthorize, requireSuperAdmin, createStaff);
router.put("/staff/:id", adminAuthorize, requireSuperAdmin, updateStaff);
router.patch("/staff/:id/deactivate", adminAuthorize, requireSuperAdmin, deactivateStaff);
router.post("/staff/:id/reset-password", adminAuthorize, requireSuperAdmin, resetStaffPassword);

// ============================================
// ADMIN MANAGEMENT (Super Admin Only)
// ============================================
router.get("/admins", adminAuthorize, requireSuperAdmin, getAllAdmins);
router.post("/admins", adminAuthorize, requireSuperAdmin, createAdmin);
router.put("/admins/:id", adminAuthorize, requireSuperAdmin, updateAdmin);
router.patch("/admins/:id/deactivate", adminAuthorize, requireSuperAdmin, deactivateAdmin);
router.get("/activity-logs", adminAuthorize, requireSuperAdmin, getAdminActivityLogs);

// ============================================
// PROGRAM MANAGEMENT (Super Admin Only)
// ============================================
router.get("/programs", adminAuthorize, requireSuperAdmin, getAllPrograms);
router.get("/programs/stats", adminAuthorize, requireSuperAdmin, getProgramStats);
router.get("/programs/:id", adminAuthorize, requireSuperAdmin, getProgramById);
router.post("/programs", adminAuthorize, requireSuperAdmin, createProgram);
router.put("/programs/:id", adminAuthorize, requireSuperAdmin, updateProgram);
router.delete("/programs/:id", adminAuthorize, requireSuperAdmin, deleteProgram);

// ============================================
// COURSE MANAGEMENT (Super Admin Only)
// ============================================
router.get("/courses", adminAuthorize, requireSuperAdmin, getAllCourses);
router.get("/courses/stats", adminAuthorize, requireSuperAdmin, getCourseStats);
router.get("/courses/program/:programId", adminAuthorize, requireSuperAdmin, getCoursesByProgram);
router.get("/courses/:id", adminAuthorize, requireSuperAdmin, getCourseById);
router.post("/courses", adminAuthorize, requireSuperAdmin, uploadCourseImageMiddleware, createCourse);
router.put("/courses/:id", adminAuthorize, requireSuperAdmin, uploadCourseImageMiddleware, updateCourse);
router.put("/courses/:id/price", adminAuthorize, requireSuperAdmin, updateCoursePrice);
router.delete("/courses/:id", adminAuthorize, requireSuperAdmin, deleteCourse);

// ============================================
// SEMESTER MANAGEMENT (Super Admin Only)
// ============================================
router.get("/semesters", adminAuthorize, requireSuperAdmin, getAllSemesters);
router.get("/semesters/current", adminAuthorize, requireSuperAdmin, getCurrentSemester);
router.get("/semesters/stats", adminAuthorize, requireSuperAdmin, getSemesterStats);
router.get("/semesters/:id", adminAuthorize, requireSuperAdmin, getSemesterById);
router.post("/semesters", adminAuthorize, requireSuperAdmin, createSemester);
router.put("/semesters/:id", adminAuthorize, requireSuperAdmin, updateSemester);
router.post("/semesters/:id/close", adminAuthorize, requireSuperAdmin, closeSemester);
router.post("/semesters/:id/extend", adminAuthorize, requireSuperAdmin, extendSemester);
router.post("/semesters/:id/activate", adminAuthorize, requireSuperAdmin, activateSemester);
router.post("/semesters/:id/extend-registration", adminAuthorize, requireSuperAdmin, extendRegistrationDeadline);
router.delete("/semesters/:id", adminAuthorize, requireSuperAdmin, deleteSemester);

// ============================================
// FACULTY MANAGEMENT (Super Admin Only)
// ============================================
router.get("/faculties", adminAuthorize, requireSuperAdmin, getAllFaculties);
router.get("/faculties/stats", adminAuthorize, requireSuperAdmin, getFacultyStats);
router.get("/faculties/:id", adminAuthorize, requireSuperAdmin, getFacultyById);
router.post("/faculties", adminAuthorize, requireSuperAdmin, createFaculty);
router.put("/faculties/:id", adminAuthorize, requireSuperAdmin, updateFaculty);
router.delete("/faculties/:id", adminAuthorize, requireSuperAdmin, deleteFaculty);

// ============================================
// NOTICE MANAGEMENT (Super Admin Only)
// ============================================
router.get("/notices", adminAuthorize, requireSuperAdmin, getAllNotices);
router.get("/notices/:id", adminAuthorize, requireSuperAdmin, getNoticeById);
router.post("/notices", adminAuthorize, requireSuperAdmin, createNotice);
router.put("/notices/:id", adminAuthorize, requireSuperAdmin, updateNotice);
router.delete("/notices/:id", adminAuthorize, requireSuperAdmin, deleteNotice);

// ============================================
// COURSE ALLOCATION MANAGEMENT (Super Admin Only)
// ============================================
router.post("/course-allocation", adminAuthorize, requireSuperAdmin, allocateCourses);
router.post("/course-allocation/allocate-all", adminAuthorize, requireSuperAdmin, allocateCoursesToAllStudentsEndpoint);
router.get("/course-allocation", adminAuthorize, requireSuperAdmin, getAllocatedCourses);
router.delete("/course-allocation/:id", adminAuthorize, requireSuperAdmin, removeAllocation);
router.delete("/course-allocation/bulk", adminAuthorize, requireSuperAdmin, bulkRemoveAllocations);

// ============================================
// COURSE PRICING MANAGEMENT (Super Admin Only)
// ============================================
router.post("/course-pricing", adminAuthorize, requireSuperAdmin, setCoursePrice);
router.post("/course-pricing/bulk", adminAuthorize, requireSuperAdmin, bulkSetCoursePrices);
router.get("/course-pricing", adminAuthorize, requireSuperAdmin, getCoursePrices);
router.post("/course-pricing/copy", adminAuthorize, requireSuperAdmin, copyCoursePrices);

// ============================================
// PAYMENT MANAGEMENT (Super Admin Only)
// ============================================
router.get("/payments/fundings", adminAuthorize, requireSuperAdmin, getAllFundings);
router.get("/payments/fundings/stats", adminAuthorize, requireSuperAdmin, getFundingStats);
router.get("/payments/school-fees", adminAuthorize, requireSuperAdmin, getAllSchoolFees);
router.get("/payments/school-fees/stats", adminAuthorize, requireSuperAdmin, getSchoolFeesStats);
router.get("/payments/course-orders", adminAuthorize, requireSuperAdmin, getAllCourseOrders);
router.get("/payments/course-orders/stats", adminAuthorize, requireSuperAdmin, getCourseOrderStats);
router.get("/payments/overview", adminAuthorize, requireSuperAdmin, getPaymentOverview);
router.post("/payments/wallet/manage", adminAuthorize, requireSuperAdmin, manageStudentWallet);

// ============================================
// SCHOOL FEES MANAGEMENT (Super Admin Only)
// ============================================
router.post("/school-fees/configuration", adminAuthorize, requireSuperAdmin, setSchoolFeesConfiguration);
router.get("/school-fees/configuration", adminAuthorize, requireSuperAdmin, getSchoolFeesConfigurations);

// ============================================
// PAYMENT SETUP MANAGEMENT (Super Admin Only)
// ============================================
router.get("/payment-setup", adminAuthorize, requireSuperAdmin, getAllPaymentSetup);
router.get("/payment-setup/stats", adminAuthorize, requireSuperAdmin, getPaymentSetupStats);
router.get("/payment-setup/:id", adminAuthorize, requireSuperAdmin, getPaymentSetupById);
router.post("/payment-setup", adminAuthorize, requireSuperAdmin, createPaymentSetup);
router.put("/payment-setup/:id", adminAuthorize, requireSuperAdmin, updatePaymentSetup);
router.delete("/payment-setup/:id", adminAuthorize, requireSuperAdmin, deletePaymentSetup);

// ============================================
// PAYMENT VERIFICATION (Super Admin Only)
// ============================================
router.post("/payments/:id/verify", adminAuthorize, requireSuperAdmin, manuallyVerifyPayment);
router.get("/payments/:id", adminAuthorize, requireSuperAdmin, getPaymentTransaction);

// ============================================
// TUTOR MANAGEMENT (Super Admin Only)
// ============================================
router.get("/tutors/sole-tutors", adminAuthorize, requireSuperAdmin, getAllSoleTutors);
router.get("/tutors/sole-tutors/:id", adminAuthorize, requireSuperAdmin, getSoleTutorById);
router.post("/tutors/sole-tutors/:id/approve", adminAuthorize, requireSuperAdmin, approveSoleTutor);
router.patch("/tutors/sole-tutors/:id/approve", adminAuthorize, requireSuperAdmin, approveSoleTutor);
router.post("/tutors/sole-tutors/:id/reject", adminAuthorize, requireSuperAdmin, rejectSoleTutor);
router.patch("/tutors/sole-tutors/:id/reject", adminAuthorize, requireSuperAdmin, rejectSoleTutor);
router.put("/tutors/sole-tutors/:id/status", adminAuthorize, requireSuperAdmin, updateSoleTutorStatus);
router.put("/tutors/sole-tutors/:id/commission", adminAuthorize, requireSuperAdmin, updateSoleTutorCommissionRate);

router.get("/tutors/organizations", adminAuthorize, requireSuperAdmin, getAllOrganizations);
router.get("/tutors/organizations/:id", adminAuthorize, requireSuperAdmin, getOrganizationById);
router.post("/tutors/organizations/:id/approve", adminAuthorize, requireSuperAdmin, approveOrganization);
router.patch("/tutors/organizations/:id/approve", adminAuthorize, requireSuperAdmin, approveOrganization);
router.post("/tutors/organizations/:id/reject", adminAuthorize, requireSuperAdmin, rejectOrganization);
router.patch("/tutors/organizations/:id/reject", adminAuthorize, requireSuperAdmin, rejectOrganization);
router.put("/tutors/organizations/:id/status", adminAuthorize, requireSuperAdmin, updateOrganizationStatus);
router.put("/tutors/organizations/:id/commission", adminAuthorize, requireSuperAdmin, updateOrganizationCommissionRate);

router.get("/tutors/stats", adminAuthorize, requireSuperAdmin, getTutorStats);

// ============================================
// STUDENT KYC MANAGEMENT (Super Admin Only)
// ============================================
// Support both URL formats for backward compatibility
router.get("/students/kyc/pending", adminAuthorize, requireSuperAdmin, getPendingDocuments);
router.get("/students/kyc/approved", adminAuthorize, requireSuperAdmin, getFullyApprovedStudents);
router.get("/students/kyc/documents", adminAuthorize, requireSuperAdmin, getStudentKycDocuments);
router.get("/students/kyc/documents/:id/signed-url", adminAuthorize, requireSuperAdmin, getStudentDocumentSignedUrl);
router.get("/students/kyc/status", adminAuthorize, requireSuperAdmin, getAllStudentsKycStatus);
router.post("/students/kyc/documents/:id/approve", adminAuthorize, requireSuperAdmin, approveStudentDocument);
router.post("/students/kyc/documents/:id/reject", adminAuthorize, requireSuperAdmin, rejectStudentDocument);

// Alternative paths (for backward compatibility)
router.get("/student-kyc/documents", adminAuthorize, requireSuperAdmin, getStudentKycDocuments);
router.get("/student-kyc/documents/:id/signed-url", adminAuthorize, requireSuperAdmin, getStudentDocumentSignedUrl);
router.get("/student-kyc/status", adminAuthorize, requireSuperAdmin, getAllStudentsKycStatus);
router.post("/student-kyc/documents/:id/approve", adminAuthorize, requireSuperAdmin, approveStudentDocument);
router.post("/student-kyc/documents/:id/reject", adminAuthorize, requireSuperAdmin, rejectStudentDocument);
router.get("/student-kyc/pending", adminAuthorize, requireSuperAdmin, getPendingDocuments);
router.get("/student-kyc/approved", adminAuthorize, requireSuperAdmin, getFullyApprovedStudents);

// ============================================
// SYSTEM SETTINGS (Super Admin Only)
// ============================================
router.get("/settings", adminAuthorize, requireSuperAdmin, getSystemSettings);
router.put("/settings", adminAuthorize, requireSuperAdmin, updateSystemSettings);

// ============================================
// REVENUE MANAGEMENT (Super Admin Only)
// ============================================
router.get("/revenue/transactions", adminAuthorize, requireSuperAdmin, getAllMarketplaceTransactions);
router.get("/revenue/marketplace-transactions", adminAuthorize, requireSuperAdmin, getAllMarketplaceTransactions); // Alias
router.get("/revenue/wpu-stats", adminAuthorize, requireSuperAdmin, getWspRevenueStatistics);
router.get("/revenue/wsp-stats", adminAuthorize, requireSuperAdmin, getWspRevenueStatistics); // Alias
router.get("/revenue/wsp-statistics", adminAuthorize, requireSuperAdmin, getWspRevenueStatistics); // Alias
router.get("/revenue/tutor/:tutorId", adminAuthorize, requireSuperAdmin, getTutorRevenueDetails);

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
