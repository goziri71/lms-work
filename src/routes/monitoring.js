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
import { redisClient, isRedisAvailable } from "../config/redis.js";
import { db, dbLibrary } from "../database/database.js";
import mongoose from "mongoose";

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
 * GET SYSTEM HEALTH (Checks all databases and Redis)
 * GET /api/monitoring/health
 */
router.get(
  "/health",
  TryCatchFunction(async (req, res) => {
    const health = {
      status: true,
      code: 200,
      message: "System health check",
      data: {
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: "MB",
        },
        services: {
          redis: {
            available: isRedisAvailable,
            status: "disconnected",
            latency: null,
          },
          postgresLms: {
            status: "disconnected",
            latency: null,
          },
          postgresLibrary: {
            status: "disconnected",
            latency: null,
          },
          mongodb: {
            status: "disconnected",
            latency: null,
          },
        },
      },
    };

    // Check Redis
    if (isRedisAvailable && redisClient) {
      try {
        const startTime = Date.now();
        await redisClient.ping();
        health.data.services.redis.latency = Date.now() - startTime;
        health.data.services.redis.status = "connected";
      } catch (error) {
        health.data.services.redis.status = "error";
      }
    } else {
      health.data.services.redis.status = "not available";
    }

    // Check PostgreSQL (LMS)
    try {
      const startTime = Date.now();
      await db.authenticate();
      health.data.services.postgresLms.latency = Date.now() - startTime;
      health.data.services.postgresLms.status = "connected";
    } catch (error) {
      health.data.services.postgresLms.status = "disconnected";
    }

    // Check PostgreSQL (Library)
    try {
      const startTime = Date.now();
      await dbLibrary.authenticate();
      health.data.services.postgresLibrary.latency = Date.now() - startTime;
      health.data.services.postgresLibrary.status = "connected";
    } catch (error) {
      health.data.services.postgresLibrary.status = "disconnected";
    }

    // Check MongoDB
    try {
      const startTime = Date.now();
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.admin().ping();
        health.data.services.mongodb.latency = Date.now() - startTime;
        health.data.services.mongodb.status = "connected";
      } else {
        health.data.services.mongodb.status = "disconnected";
      }
    } catch (error) {
      health.data.services.mongodb.status = "disconnected";
    }

    // Determine overall health
    const allServicesHealthy =
      health.data.services.redis.status === "connected" &&
      health.data.services.postgresLms.status === "connected" &&
      health.data.services.postgresLibrary.status === "connected" &&
      health.data.services.mongodb.status === "connected";

    if (!allServicesHealthy) {
      health.status = false;
      health.code = 503;
      health.message = "Some services are unhealthy";
    } else {
      health.message = "All services are healthy";
    }

    res.status(allServicesHealthy ? 200 : 503).json(health);
  })
);

export default router;
