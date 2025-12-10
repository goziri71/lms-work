import { Router } from "express";
import { authorize } from "../middlewares/authorize.js";
import { getActiveNotices } from "../controllers/notice/notice.js";

const router = Router();

// Get active notices for students and staff
router.get("/", authorize, getActiveNotices);

export default router;

