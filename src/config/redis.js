import Redis from "ioredis";
import { Config } from "./config.js";

let redisClient = null;
let isRedisAvailable = false;

// Skip Redis in development if explicitly disabled
const REDIS_ENABLED = process.env.REDIS_ENABLED !== "false";

try {
  // Skip Redis setup if disabled
  if (!REDIS_ENABLED) {
    console.log("⚠️ Redis disabled in config - using in-memory storage");
    throw new Error("Redis disabled");
  }

  // Try to create Redis client
  // Support both REDIS_URL (Render) and individual config
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    // Parse connection string for Render Redis
    const options = {
      retryStrategy: (times) => {
        // Only retry once
        if (times > 1) {
          console.log("⚠️ Redis unavailable - running without cache");
          return null;
        }
        return 200; // Wait 200ms before retry
      },
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      enableReadyCheck: true,
      connectTimeout: 5000, // 5 second timeout
      lazyConnect: true, // Don't auto-connect, we'll connect manually
    };

    // Add TLS support for rediss:// URLs
    if (redisUrl.startsWith("rediss://")) {
      options.tls = {
        rejectUnauthorized: false, // Accept self-signed certificates
      };
    }

    redisClient = new Redis(redisUrl, options);
  } else {
    // Use individual config
    redisClient = new Redis({
      host: Config.REDIS_HOST || "localhost",
      port: Config.REDIS_PORT || 6379,
      password: Config.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        // Only retry once
        if (times > 1) {
          console.log("⚠️ Redis unavailable - running without cache");
          return null;
        }
        return 200; // Wait 200ms before retry
      },
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 5000, // 5 second timeout
    });
  }

  // Track if we've already logged the first connection
  let hasLoggedConnection = false;

  redisClient.on("connect", () => {
    if (!hasLoggedConnection) {
      console.log("✅ Redis connected successfully");
      hasLoggedConnection = true;
    }
    isRedisAvailable = true;
  });

  redisClient.on("error", (err) => {
    isRedisAvailable = false;
    // Only log critical errors, not connection retries
    if (err.code !== "ECONNREFUSED" && err.code !== "ETIMEDOUT") {
      console.error("❌ Redis error:", err.message);
    }
  });

  // Try to connect
  redisClient.connect().catch((err) => {
    console.log(
      "⚠️ Redis connection failed - running without cache/rate-limit persistence"
    );
    if (process.env.NODE_ENV === "development") {
      console.log(`   Reason: ${err.message}`);
    }
    isRedisAvailable = false;
  });
} catch (error) {
  console.log("⚠️ Redis initialization failed - running without cache");
  redisClient = null;
  isRedisAvailable = false;
}

export { redisClient, isRedisAvailable };

// Helper functions
export const cacheHelper = {
  // Get cached data
  async get(key) {
    if (!isRedisAvailable || !redisClient) return null;
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  },

  // Set cache with expiration (in seconds)
  async set(key, value, expirationInSeconds = 3600) {
    if (!isRedisAvailable || !redisClient) return false;
    try {
      await redisClient.setex(key, expirationInSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  },

  // Delete cache
  async del(key) {
    if (!isRedisAvailable || !redisClient) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      return false;
    }
  },

  // Delete multiple keys by pattern
  async delPattern(pattern) {
    if (!isRedisAvailable || !redisClient) return false;
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      return true;
    } catch (error) {
      return false;
    }
  },

  // Check if key exists
  async exists(key) {
    if (!isRedisAvailable || !redisClient) return false;
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      return false;
    }
  },
};
