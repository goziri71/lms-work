/**
 * MongoDB connection helpers for chat (DMs, discussions).
 * Atlas URI is optional at boot; background retry restores chat without restart
 * once MONGO_URI / network / Atlas is fixed.
 */
import mongoose from "mongoose";

let retryTimer = null;
let connecting = false;
let lastError = null;

export function isMongoReady() {
  return mongoose.connection?.readyState === 1;
}

export function getMongoStatus() {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return {
    ready: isMongoReady(),
    readyState: mongoose.connection?.readyState ?? 0,
    state: states[mongoose.connection?.readyState] || "unknown",
    lastError: lastError,
  };
}

function extractMongoHost(uri) {
  if (!uri) return null;
  try {
    const normalized = uri.replace(/^mongodb(\+srv)?:\/\//, "http://");
    return new URL(normalized).hostname || null;
  } catch {
    return null;
  }
}

export async function connectMongo(options = {}) {
  const { silent = false } = options;
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    lastError = "MONGO_URI not set";
    if (!silent) {
      console.warn(
        "⚠️  MONGO_URI not set — chat features unavailable. Continuing without MongoDB."
      );
    }
    return false;
  }

  if (isMongoReady()) return true;
  if (connecting) return false;

  connecting = true;
  const host = extractMongoHost(mongoUri);

  try {
    // Avoid stacking connections if a previous attempt left mongoose mid-state
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect();
      } catch {
        /* ignore */
      }
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 0,
    });

    lastError = null;
    if (!silent) {
      console.log("✅ MongoDB connection established successfully.");
      console.log(`   Database: ${mongoose.connection.db.databaseName}`);
    } else {
      console.log("✅ MongoDB reconnected — chat available again.");
    }
    return true;
  } catch (mongoError) {
    lastError = mongoError.message;
    const isDns =
      /ENOTFOUND|querySrv|ECONNREFUSED|getaddrinfo/i.test(mongoError.message) ||
      mongoError.code === "ENOTFOUND";

    if (!silent) {
      console.warn(
        "⚠️  MongoDB connection failed (chat may be unavailable):",
        mongoError.message
      );
      if (host) {
        console.warn(`   Host: ${host}`);
      }
      if (isDns) {
        console.warn(
          "   DNS lookup failed — Atlas cluster hostname is missing/renamed/deleted, or network cannot resolve SRV records."
        );
        console.warn(
          "   Fix: Atlas → Database → Connect → copy a fresh connection string into MONGO_URI (Render + local .env), then restart."
        );
      } else {
        console.warn(
          "   Also check Atlas Network Access (allow Render IPs) and DB user password."
        );
      }
    }
    return false;
  } finally {
    connecting = false;
  }
}

/** Periodic retry so chat recovers after Atlas/URI fix without full redeploy. */
export function startMongoReconnectLoop(intervalMs = 60_000) {
  if (retryTimer) return;
  if (!process.env.MONGO_URI) return;

  retryTimer = setInterval(async () => {
    if (isMongoReady() || connecting) return;
    await connectMongo({ silent: true });
  }, intervalMs);

  // Don't keep process alive solely for this timer
  if (typeof retryTimer.unref === "function") retryTimer.unref();
}

export function stopMongoReconnectLoop() {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}
