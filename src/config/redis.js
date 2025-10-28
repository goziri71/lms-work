import Redis from "ioredis";
import { Config } from "./config.js";

let redisClient = null;
let isRedisAvailable = false;

try {
  // Try to create Redis client
  // Support both REDIS_URL (Render) and individual config
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    // Parse connection string for Render Redis
    const options = {
      retryStrategy: (times) => {
        if (times > 3) {
          console.log("⚠️ Redis unavailable - running without cache");
          return null;
        }
        const delay = Math.min(times * 50, 500);
        return delay;
      },
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
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
        if (times > 3) {
          console.log("⚠️ Redis unavailable - running without cache");
          return null;
        }
        const delay = Math.min(times * 50, 500);
        return delay;
      },
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
  }

  redisClient.on("connect", () => {
    console.log("✅ Redis connected successfully");
    isRedisAvailable = true;
  });

  redisClient.on("error", (err) => {
    console.log("⚠️ Redis not available:", err.message);
    isRedisAvailable = false;
  });

  // Try to connect
  redisClient.connect().catch(() => {
    console.log(
      "⚠️ Redis connection failed - running without cache/rate-limit persistence"
    );
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
