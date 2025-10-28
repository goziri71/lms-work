import { cacheHelper } from "../config/redis.js";

// Check if Redis is available
let cacheEnabled = false;
try {
  if (cacheHelper) {
    cacheEnabled = true;
  }
} catch (error) {
  console.log("⚠️ Caching disabled (Redis not available)");
}

/**
 * Cache middleware for GET requests
 * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
 * @param {function} keyGenerator - Function to generate cache key from req
 */
export const cacheMiddleware = (ttl = 300, keyGenerator = null) => {
  return async (req, res, next) => {
    // Skip if caching is disabled
    if (!cacheEnabled) {
      return next();
    }

    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator
        ? keyGenerator(req)
        : `cache:${req.originalUrl}:${req.user?.id || "guest"}`;

      // Try to get from cache
      const cachedData = await cacheHelper.get(cacheKey);

      if (cachedData) {
        return res.status(200).json(cachedData);
      }

      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = function (data) {
        // Only cache successful AND small responses (< 10 KB)
        if (data.status === true || data.success === true) {
          const dataSize = JSON.stringify(data).length;

          // Skip caching if response is larger than 10 KB
          if (dataSize < 10240) {
            cacheHelper.set(cacheKey, data, ttl).catch((err) => {
              console.error("Cache set error:", err.message);
            });
          }
        }

        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error("Cache middleware error:", error.message);
      // Don't break the request if caching fails
      next();
    }
  };
};

/**
 * Invalidate cache by pattern
 */
export const invalidateCache = async (pattern) => {
  try {
    await cacheHelper.delPattern(pattern);
  } catch (error) {
    console.error("Cache invalidation error:", error.message);
  }
};

/**
 * Common cache key generators
 */
export const cacheKeys = {
  // Exam by ID
  exam: (examId, userId) => `exam:${examId}:user:${userId}`,

  // Student exams list
  studentExams: (userId, academicYear, semester) =>
    `student:${userId}:exams:${academicYear || "all"}:${semester || "all"}`,

  // Staff exams list
  staffExams: (staffId, query) =>
    `staff:${staffId}:exams:${JSON.stringify(query)}`,

  // Question bank
  questionBank: (courseId, filters) =>
    `questions:course:${courseId}:${JSON.stringify(filters)}`,

  // Attempt details
  attempt: (attemptId, userId) => `attempt:${attemptId}:user:${userId}`,

  // Exam statistics
  examStats: (examId) => `exam:${examId}:stats`,
};
