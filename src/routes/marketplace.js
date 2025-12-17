import express from "express";
import {
  registerSoleTutor,
  registerOrganization,
  soleTutorLogin,
  organizationLogin,
  organizationUserLogin,
} from "../controllers/marketplace/tutorAuth.js";
import { purchaseMarketplaceCourse } from "../controllers/marketplace/coursePurchase.js";
import { getMyMarketplaceCourses } from "../controllers/marketplace/myMarketplaceCourses.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication)
// ============================================

// Registration
router.post("/register/sole-tutor", registerSoleTutor);
router.post("/register/organization", registerOrganization);

// Login
router.post("/login/sole-tutor", soleTutorLogin);
router.post("/login/organization", organizationLogin);
router.post("/login/organization-user", organizationUserLogin);

// ============================================
// AUTHENTICATED ROUTES
// ============================================
// Course Purchase (Student only)
router.post("/courses/purchase", authorize, purchaseMarketplaceCourse);

// Get My Marketplace Courses (Student only - lifetime access courses)
router.get("/courses/my-courses", authorize, getMyMarketplaceCourses);

// TODO: Add tutor dashboard, course management, etc.

export default router;

