/**
 * Performance Monitoring Middleware
 * Tracks response times, errors, and endpoint usage
 */

// In-memory stats (use Redis or DB for production persistence)
const stats = {
  requests: {
    total: 0,
    byEndpoint: {},
    byMethod: {},
  },
  errors: {
    total: 0,
    byStatusCode: {},
    recent: [], // Last 100 errors
  },
  performance: {
    byEndpoint: {},
  },
};

/**
 * Performance monitoring middleware
 */
export const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const endpoint = `${req.method} ${req.route?.path || req.path}`;

  // Increment request counters
  stats.requests.total++;
  stats.requests.byEndpoint[endpoint] =
    (stats.requests.byEndpoint[endpoint] || 0) + 1;
  stats.requests.byMethod[req.method] =
    (stats.requests.byMethod[req.method] || 0) + 1;

  // Capture original end method
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Track performance
    if (!stats.performance.byEndpoint[endpoint]) {
      stats.performance.byEndpoint[endpoint] = {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        slowRequests: 0, // > 1000ms
      };
    }

    const perfStats = stats.performance.byEndpoint[endpoint];
    perfStats.count++;
    perfStats.totalTime += duration;
    perfStats.avgTime = perfStats.totalTime / perfStats.count;
    perfStats.minTime = Math.min(perfStats.minTime, duration);
    perfStats.maxTime = Math.max(perfStats.maxTime, duration);

    if (duration > 1000) {
      perfStats.slowRequests++;
    }

    // Track errors
    if (statusCode >= 400) {
      stats.errors.total++;
      stats.errors.byStatusCode[statusCode] =
        (stats.errors.byStatusCode[statusCode] || 0) + 1;

      // Store recent error (limit to 100)
      stats.errors.recent.unshift({
        timestamp: new Date().toISOString(),
        endpoint,
        method: req.method,
        statusCode,
        duration,
        ip: req.ip,
        userId: req.user?.id,
        userType: req.user?.userType,
      });

      if (stats.errors.recent.length > 100) {
        stats.errors.recent.pop();
      }
    }

    // Log slow requests (> 2 seconds)
    if (duration > 2000) {
      console.warn(`⚠️ SLOW REQUEST: ${endpoint} took ${duration}ms`);
    }

    // Log errors
    if (statusCode >= 500) {
      console.error(
        `❌ SERVER ERROR: ${endpoint} - ${statusCode} (${duration}ms)`
      );
    }

    // Call original end
    return originalEnd.apply(res, args);
  };

  next();
};

/**
 * Get performance statistics
 */
export const getPerformanceStats = () => {
  // Calculate top slow endpoints
  const slowEndpoints = Object.entries(stats.performance.byEndpoint)
    .map(([endpoint, data]) => ({
      endpoint,
      avgTime: Math.round(data.avgTime),
      maxTime: data.maxTime,
      slowRequests: data.slowRequests,
      count: data.count,
    }))
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 10);

  // Calculate error rate
  const errorRate =
    stats.requests.total > 0
      ? ((stats.errors.total / stats.requests.total) * 100).toFixed(2)
      : 0;

  return {
    requests: {
      total: stats.requests.total,
      byMethod: stats.requests.byMethod,
      topEndpoints: Object.entries(stats.requests.byEndpoint)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([endpoint, count]) => ({ endpoint, count })),
    },
    errors: {
      total: stats.errors.total,
      rate: `${errorRate}%`,
      byStatusCode: stats.errors.byStatusCode,
      recent: stats.errors.recent.slice(0, 10), // Last 10
    },
    performance: {
      slowEndpoints,
      totalSlowRequests: Object.values(stats.performance.byEndpoint).reduce(
        (sum, data) => sum + data.slowRequests,
        0
      ),
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
};

/**
 * Reset statistics
 */
export const resetStats = () => {
  stats.requests.total = 0;
  stats.requests.byEndpoint = {};
  stats.requests.byMethod = {};
  stats.errors.total = 0;
  stats.errors.byStatusCode = {};
  stats.errors.recent = [];
  stats.performance.byEndpoint = {};

  return { message: "Statistics reset successfully" };
};
