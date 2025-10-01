import express from "express";
import {
  createCall,
  getCall,
  generateToken,
  listCalls,
  endCall,
} from "../controllers/video/videoController.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// All video routes require authentication
router.use(authorize);

// Create a new call (staff only)
router.post("/calls", createCall);

// List calls (filtered by courseId if provided)
router.get("/calls", listCalls);

// Get call details
router.get("/calls/:id", getCall);

// Generate token to join a call
router.post("/calls/:id/token", generateToken);

// End a call (host only)
router.post("/calls/:id/end", endCall);

export default router;
