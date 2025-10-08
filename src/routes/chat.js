import { Router } from "express";
import { authorize } from "../middlewares/authorize.js";
import { getRecentDMThreads } from "../controllers/chat/directController.js";

const router = Router();

// Recent 1:1 threads for authenticated user
router.get("/dm/threads", authorize, getRecentDMThreads);

export default router;
