import { Router } from "express";
import { authorize } from "../middlewares/authorize.js";
import {
  uploadProfileImageHandler,
  uploadProfileImageMiddleware,
  uploadKycDocument,
  uploadFileMiddleware,
  getKycDocuments,
  getSignedUrl,
  updateSchoolInfo,
} from "../controllers/student/kyc.js";

const router = Router();

// KYC endpoints (student only)
router.post(
  "/profile-image",
  authorize,
  uploadProfileImageMiddleware,
  uploadProfileImageHandler
);

router.post(
  "/documents",
  authorize,
  uploadFileMiddleware,
  uploadKycDocument
);

router.get("/documents", authorize, getKycDocuments);

router.post("/documents/signed-url", authorize, getSignedUrl);

router.put("/schools", authorize, updateSchoolInfo);

export default router;

