import express from "express";
import { authorize } from "../middlewares/authorize.js";
import { TryCatchFunction } from "../utils/tryCatch/index.js";
import { ErrorClass } from "../utils/errorClass/index.js";
import {
  getPerformanceStats,
  resetStats,
} from "../middlewares/performanceMonitor.js";
import {
  getUserIPHistory,
  getActiveSessions,
} from "../middlewares/ipTracker.js";

const router = express.Router();

/**
 * GET SYSTEM PERFORMANCE STATS (Admin/Staff only)
 * GET /api/monitoring/stats
 */
router.get(
  "/stats",
  authorize,
  TryCatchFunction(async (req, res) => {
    const userType = req.user?.userType;

    // Only staff can view system stats
    if (userType !== "staff") {
      throw new ErrorClass("Access denied", 403);
    }

    const stats = getPerformanceStats();

    res.status(200).json({
      status: true,
      code: 200,
      message: "Performance stats retrieved successfully",
      data: stats,
    });
  })
);

/**
 * RESET PERFORMANCE STATS (Admin only)
 * POST /api/monitoring/stats/reset
 */
router.post(
  "/stats/reset",
  authorize,
  TryCatchFunction(async (req, res) => {
    const userType = req.user?.userType;

    if (userType !== "staff") {
      throw new ErrorClass("Access denied", 403);
    }

    const result = resetStats();

    res.status(200).json({
      status: true,
      code: 200,
      message: result.message,
    });
  })
);

/**
 * GET USER IP HISTORY (Staff checking student, or own history)
 * GET /api/monitoring/ip-history/:userId
 */
router.get(
  "/ip-history/:userId",
  authorize,
  TryCatchFunction(async (req, res) => {
    const staffId = req.user?.id;
    const userType = req.user?.userType;
    const targetUserId = Number(req.params.userId);
    const targetUserType = req.query.userType || "student";

    // Staff can check any user, students can only check themselves
    if (userType === "student" && targetUserId !== staffId) {
      throw new ErrorClass("Access denied", 403);
    }

    const history = await getUserIPHistory(targetUserId, targetUserType);

    res.status(200).json({
      status: true,
      code: 200,
      message: "IP history retrieved successfully",
      data: history,
    });
  })
);

/**
 * GET ACTIVE SESSIONS (for a user)
 * GET /api/monitoring/active-sessions/:userId
 */
router.get(
  "/active-sessions/:userId",
  authorize,
  TryCatchFunction(async (req, res) => {
    const staffId = req.user?.id;
    const userType = req.user?.userType;
    const targetUserId = Number(req.params.userId);
    const targetUserType = req.query.userType || "student";

    // Staff can check any user, students can only check themselves
    if (userType === "student" && targetUserId !== staffId) {
      throw new ErrorClass("Access denied", 403);
    }

    const sessions = await getActiveSessions(targetUserId, targetUserType);

    res.status(200).json({
      status: true,
      code: 200,
      message: "Active sessions retrieved successfully",
      data: {
        userId: targetUserId,
        userType: targetUserType,
        activeSessions: sessions,
        count: sessions.length,
      },
    });
  })
);

/**
 * GET SYSTEM HEALTH
 * GET /api/monitoring/health
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    status: true,
    code: 200,
    message: "System is healthy",
    data: {
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: "MB",
      },
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
