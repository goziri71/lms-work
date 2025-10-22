/**
 * IP Tracking Middleware for Security
 * Tracks user IPs and detects suspicious activity
 */

import { cacheHelper } from "../config/redis.js";

// In-memory IP tracking (fallback if Redis unavailable)
const ipTracker = {
  userSessions: {}, // userId -> [{ ip, timestamp, userAgent }]
};

/**
 * Track user login IPs
 */
export const trackLoginIP = async (req, res, next) => {
  const userId = req.user?.id;
  const userType = req.user?.userType;

  if (!userId) return next();

  const ip =
    req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.headers["user-agent"];
  const timestamp = new Date().toISOString();

  const sessionKey = `ip:${userType}:${userId}`;

  try {
    // Try Redis first
    const sessions = (await cacheHelper.get(sessionKey)) || [];

    // Add new session
    sessions.unshift({ ip, userAgent, timestamp });

    // Keep last 10 sessions
    if (sessions.length > 10) {
      sessions.splice(10);
    }

    // Check for suspicious activity
    const uniqueIPs = new Set(sessions.map((s) => s.ip));
    const recentIPs = sessions.slice(0, 3).map((s) => s.ip);

    // Alert if multiple IPs in last 3 logins
    if (new Set(recentIPs).size >= 3) {
      console.warn(
        `⚠️ SUSPICIOUS: User ${userId} (${userType}) logged in from ${recentIPs.length} different IPs recently`
      );

      // Could send alert email, create notification, etc.
      req.suspiciousActivity = true;
    }

    // Store in Redis (1 month expiry)
    await cacheHelper.set(sessionKey, sessions, 30 * 24 * 60 * 60);

    // Also store in memory as backup
    ipTracker.userSessions[sessionKey] = sessions;

    // Attach to request for logging
    req.ipInfo = {
      current: ip,
      previous: sessions.slice(1, 4),
      isSuspicious: req.suspiciousActivity,
    };
  } catch (error) {
    console.error("IP tracking error:", error.message);
  }

  next();
};

/**
 * Get user's IP history
 */
export const getUserIPHistory = async (userId, userType) => {
  const sessionKey = `ip:${userType}:${userId}`;

  try {
    // Try Redis first
    let sessions = await cacheHelper.get(sessionKey);

    // Fallback to memory
    if (!sessions) {
      sessions = ipTracker.userSessions[sessionKey] || [];
    }

    return {
      userId,
      userType,
      sessions,
      uniqueIPs: [...new Set(sessions.map((s) => s.ip))],
      lastLogin: sessions[0]?.timestamp,
    };
  } catch (error) {
    console.error("Get IP history error:", error.message);
    return null;
  }
};

/**
 * Check if current exam attempt is from same IP as exam start
 */
export const validateExamIP = async (req, res, next) => {
  const attemptId = req.params.attemptId;
  const currentIP = req.ip || req.headers["x-forwarded-for"];

  try {
    // Get IP used to start exam
    const startIPKey = `exam_ip:${attemptId}`;
    const startIP = await cacheHelper.get(startIPKey);

    if (startIP && startIP !== currentIP) {
      console.warn(
        `⚠️ EXAM IP MISMATCH: Attempt ${attemptId} - Started: ${startIP}, Current: ${currentIP}`
      );

      // Log but don't block (could be mobile switching networks)
      req.ipMismatch = true;
      req.examIPInfo = {
        start: startIP,
        current: currentIP,
      };
    }
  } catch (error) {
    console.error("Exam IP validation error:", error.message);
  }

  next();
};

/**
 * Store exam start IP
 */
export const storeExamStartIP = async (attemptId, ip) => {
  try {
    const startIPKey = `exam_ip:${attemptId}`;
    // Store for 24 hours
    await cacheHelper.set(startIPKey, ip, 24 * 60 * 60);
  } catch (error) {
    console.error("Store exam IP error:", error.message);
  }
};

/**
 * Get all active sessions for a user
 */
export const getActiveSessions = async (userId, userType) => {
  try {
    const history = await getUserIPHistory(userId, userType);

    if (!history) return [];

    // Sessions in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeSessions = history.sessions.filter(
      (s) => new Date(s.timestamp) > oneDayAgo
    );

    return activeSessions;
  } catch (error) {
    console.error("Get active sessions error:", error.message);
    return [];
  }
};
