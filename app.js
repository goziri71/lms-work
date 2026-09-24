import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { connectDB } from "./src/database/database.js";
import authRoutes from "./src/routes/auth.js";
import courseRoutes from "./src/routes/courses.js";
import semesterRoutes from "./src/routes/semesters.js";
import modulesRoutes from "./src/routes/modules.js";
import quizRoutes from "./src/routes/quiz.js";
import studentRoutes from "./src/routes/student.js";
import videoRoutes from "./src/routes/video.js";
import chatRoutes from "./src/routes/chat.js";
import examRoutes from "./src/routes/exams.js";
import monitoringRoutes from "./src/routes/monitoring.js";
import adminRoutes from "./src/routes/admin.js";
import marketplaceRoutes from "./src/routes/marketplace.js";
import webhookRoutes from "./src/routes/webhooks.js";
import walletRoutes from "./src/routes/wallet.js";
import noticeRoutes from "./src/routes/notice.js";
import kycRoutes from "./src/routes/kyc.js";
import {
  getProgramById,
  getFacultyById,
} from "./src/controllers/public/programFacultyController.js";
import { getSalesPageBySlug } from "./src/controllers/public/salesPage.js";
import { authorize } from "./src/middlewares/authorize.js";
import { setupAssociations } from "./src/models/associations.js";
import { setupExamAssociations } from "./src/models/exams/index.js";
import { setupDiscussionsSocket } from "./src/realtime/discussions.js";
import { setupDirectChatSocket } from "./src/realtime/directChat.js";
import { setupCoachingMessagingSocket } from "./src/realtime/coachingMessaging.js";
import { performanceMonitor } from "./src/middlewares/performanceMonitor.js";
import { trackLoginIP } from "./src/middlewares/ipTracker.js";
import { EmailLog } from "./src/models/email/emailLog.js";
import {
  TutorMailbox,
  MailThread,
  MailMessage,
} from "./src/models/marketplace/index.js";
import { WpuBookUpload } from "./src/models/wpu/wpuBookUpload.js";
import wpuRoutes from "./src/routes/wpu.js";
import { db } from "./src/database/database.js";
import {
  scheduleBackgroundJob,
  scheduleBackgroundInterval,
} from "./src/utils/backgroundJobRunner.js";
import { Config } from "./src/config/config.js";

// CORS allow-list: the known first-party frontends, plus anything listed in
// ADDITIONAL_CORS_ORIGINS (comma-separated) for staging/marketing domains
// that also call this API. Requests with no Origin header (mobile apps,
// server-to-server calls, curl, Postman) are always allowed through, since
// those aren't the same-origin browsers CORS protects against — this only
// restricts which *browser* origins may call the API with credentials-style
// access.
const allowedOrigins = new Set(
  [
    Config.frontendUrl,
    Config.adminFrontendUrl,
    ...(process.env.ADDITIONAL_CORS_ORIGINS || "").split(","),
  ]
    .map((o) => (o || "").trim().replace(/\/+$/, ""))
    .filter(Boolean),
);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return allowedOrigins.has(origin.replace(/\/+$/, ""));
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
};

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
  },
});
const PORT = process.env.PORT || 3000;

// Socket.io keeps room/connection state in-process by default. Under a
// clustered/multi-process deploy, a student connected to worker A would
// never see a broadcast emitted from worker B (chat, discussions, coaching
// messaging) without this adapter fanning events out over Redis. Degrades
// gracefully to in-process-only behavior if Redis isn't reachable, matching
// this app's existing "best effort" Redis usage elsewhere.
if (process.env.REDIS_URL) {
  try {
    const { createAdapter } = await import("@socket.io/redis-adapter");
    const { default: Redis } = await import("ioredis");
    const redisOpts = {
      ...(process.env.REDIS_URL.startsWith("rediss://")
        ? { tls: { rejectUnauthorized: false } }
        : {}),
      // Keep retrying (unlike the best-effort cache client) since losing
      // this connection means losing cross-worker realtime, but cap the
      // backoff so a prolonged outage logs periodically instead of spinning.
      retryStrategy: (times) => Math.min(times * 500, 10000),
    };
    const pubClient = new Redis(process.env.REDIS_URL, redisOpts);
    const subClient = pubClient.duplicate();
    pubClient.on("error", (err) =>
      console.warn("⚠️ Socket.io Redis adapter (pub) error:", err.message),
    );
    subClient.on("error", (err) =>
      console.warn("⚠️ Socket.io Redis adapter (sub) error:", err.message),
    );
    io.adapter(createAdapter(pubClient, subClient));
    console.log("🔌 Socket.io Redis adapter attached (cross-worker realtime enabled)");
  } catch (error) {
    console.warn(
      "⚠️ Could not attach Socket.io Redis adapter — realtime features will be process-local only:",
      error.message,
    );
  }
} else {
  console.warn(
    "⚠️ REDIS_URL not set — Socket.io realtime features will be process-local only (breaks across clustered workers).",
  );
}

// When running under a PM2 cluster (or any multi-process setup), only one
// worker should run boot-time schema sync/ALTER statements and cron-style
// background jobs (subscription renewals, wallet-affecting jobs, etc). PM2
// sets NODE_APP_INSTANCE per worker (0, 1, 2, ...); every other process
// manager either leaves it unset or sets it to a single value, so treating
// "0 or unset" as primary is safe for both clustered and single-process runs.
const isPrimaryInstance = (process.env.NODE_APP_INSTANCE ?? "0") === "0";

// Middleware
app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());
// Body size limit: some endpoints embed base64 images directly in JSON
// (rich-text lesson/unit content, bulk question uploads), so this can't be
// cut down to a couple of MB without risking breaking those — but 50MB
// applied to every endpoint (including login, password reset, etc.) let any
// client force this process to buffer and JSON-parse a 50MB body per
// request, which blocks the event loop. 20MB keeps comfortable headroom for
// the legitimate large-payload endpoints while meaningfully shrinking that
// worst case.
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Performance monitoring
app.use(performanceMonitor);

// IP tracking (after auth)
app.use(trackLoginIP);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/video", videoRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/student/kyc", kycRoutes);
app.use("/api/wpu", wpuRoutes);

// Public sales page by slug (so /api/public/sales/:slug works without /marketplace)
app.get("/api/public/sales/:slug", getSalesPageBySlug);

app.use("/api", modulesRoutes);

// ============================================
// PUBLIC STUDENT-ACCESSIBLE ROUTES (Requires Authentication)
// ============================================
// Get program details by ID (Student-accessible)
app.get("/api/programs/:id", authorize, getProgramById);

// Get faculty details by ID (Student-accessible)
app.get("/api/faculties/:id", authorize, getFacultyById);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Global error handler for TryCatchFunction
app.use((error, req, res, next) => {
  // Log error for debugging
  console.error("❌ Error:", error.message);
  if (process.env.NODE_ENV === "development") {
    console.error("Stack trace:", error.stack);
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({
      status: false,
      code: error.statusCode,
      message: error.message,
    });
  }

  const msg = error.message || "";
  const errName =
    error.name || error.parent?.name || error.original?.name || "";
  const isDbPoolTimeout =
    errName === "SequelizeConnectionAcquireTimeoutError" ||
    errName === "SequelizeConnectionError" ||
    errName === "ConnectionAcquireTimeoutError" ||
    msg.includes("Operation timeout") ||
    msg.includes("Connection terminated");

  if (isDbPoolTimeout) {
    console.error("❌ Database pool/connection error:", msg);
    return res.status(503).json({
      status: false,
      code: 503,
      message:
        "Database is temporarily unavailable. Please wait a moment and try again.",
    });
  }

  res.status(500).json({
    status: false,
    code: 500,
    message: "Internal server error",
    ...(process.env.NODE_ENV === "development" && { error: error.message }),
  });
});

// Connect to databases
connectDB().then(async (success) => {
  if (success) {
    // Set up model associations after database connection
    setupAssociations();
    setupExamAssociations();
    console.log("🔗 Model associations established");

    // Schema sync / ALTER statements must only run once, not once per
    // clustered worker (concurrent ALTERs against the same tables at boot
    // would race). Everything in this block is boot-time schema setup.
    if (isPrimaryInstance) {
    // Ensure critical tables exist (especially email_logs)
    try {
      const [tableExists] = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'email_logs'
        )
      `);

      if (!tableExists[0].exists) {
        console.log("📧 Creating email_logs table...");
        // Use force: false to create table without dropping existing data
        await EmailLog.sync({ force: false });
        console.log("✅ email_logs table created");
      } else {
        // Table exists - just verify it's accessible (don't alter to avoid errors)
        try {
          await db.query("SELECT 1 FROM email_logs LIMIT 1");
          console.log("✅ email_logs table verified");
        } catch (verifyError) {
          console.warn(
            "⚠️ email_logs table exists but may have issues:",
            verifyError.message,
          );
        }
      }
    } catch (error) {
      console.error(
        "⚠️ Warning: Could not verify/create email_logs table:",
        error.message,
      );
      if (error.message.includes("USING") || error.message.includes("syntax")) {
        console.error(
          "   This is likely a Sequelize sync issue. Trying alternative method...",
        );
        try {
          // Try creating table with raw SQL as fallback
          await db.query(`
            CREATE TABLE IF NOT EXISTS email_logs (
              id SERIAL PRIMARY KEY,
              user_id INTEGER,
              user_type VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (user_type IN ('student', 'staff', 'other')),
              recipient_email VARCHAR(255) NOT NULL,
              recipient_name VARCHAR(255),
              email_type VARCHAR(50) NOT NULL CHECK (email_type IN ('welcome', 'password_reset', 'email_verification', 'course_enrollment', 'exam_reminder', 'exam_published', 'grade_notification', 'quiz_deadline', 'announcement', 'other')),
              subject VARCHAR(255) NOT NULL,
              status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
              zepto_message_id VARCHAR(255),
              error_message TEXT,
              sent_at TIMESTAMP,
              metadata JSONB,
              created_at TIMESTAMP NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id, user_type);
            CREATE INDEX IF NOT EXISTS idx_email_logs_email ON email_logs(recipient_email);
            CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
            CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
            CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);
          `);
          console.log("✅ email_logs table created using raw SQL");
        } catch (fallbackError) {
          console.error(
            "❌ Fallback creation also failed:",
            fallbackError.message,
          );
          console.error(
            "   Please run 'node setup-email-logs-table.js' manually",
          );
        }
      } else {
        console.error(
          "   Run 'node setup-email-logs-table.js' manually to create the table",
        );
      }
    }

    try {
      await TutorMailbox.sync({ alter: false });
      await MailThread.sync({ alter: false });
      await MailMessage.sync({ alter: false });
      console.log("✅ Tutor mailbox tables (tutor_mailboxes, mail_threads, mail_messages) ready");
    } catch (mbErr) {
      console.warn("⚠️ Tutor mailbox table sync:", mbErr.message);
    }

    try {
      await WpuBookUpload.sync({ alter: true });
      console.log("✅ wpu_book_uploads table ready");
    } catch (wpuErr) {
      console.warn("⚠️ wpu_book_uploads sync:", wpuErr.message);
    }

    // Auto-add author_type columns if missing (for community posts/comments)
    try {
      await db.query(`ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS author_type VARCHAR(30) DEFAULT NULL`);
      await db.query(`ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS author_type VARCHAR(30) DEFAULT NULL`);
      console.log("✅ community author_type columns verified");
    } catch (colErr) {
      console.warn("⚠️ Could not verify author_type columns:", colErr.message);
    }
    } // end isPrimaryInstance (schema sync)

    setupDiscussionsSocket(io);
    setupDirectChatSocket(io);
    setupCoachingMessagingSocket(io);

    // Cron-style background jobs must only run in one worker when clustered.
    // Several of these are billing-affecting (subscription auto-renewal
    // debits wallets) — running them in every worker would double-charge.
    if (isPrimaryInstance) {

    // Setup background jobs for subscriptions
    try {
      const { processAutoRenewals, expireSubscriptions } =
        await import("./src/services/subscriptionRenewalService.js");

      // Helper to check if it's time to run daily job (2 AM)
      const shouldRunDailyJob = () => {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        return hour === 2 && minute === 0;
      };

      let lastDailyRun = new Date();
      lastDailyRun.setHours(0, 0, 0, 0); // Reset to start of day

      // Check every hour if it's time to run daily jobs
      setInterval(
        async () => {
          const now = new Date();
          const hoursSinceLastRun = (now - lastDailyRun) / (1000 * 60 * 60);

          // Run if it's been at least 24 hours since last run and it's around 2-3 AM
          if (
            hoursSinceLastRun >= 24 &&
            now.getHours() >= 2 &&
            now.getHours() < 4
          ) {
            console.log("🔄 Processing subscription auto-renewals...");
            try {
              const results = await processAutoRenewals();
              console.log(
                `✅ Auto-renewal completed: ${results.successful} successful, ${results.failed} failed`,
              );
              if (results.errors.length > 0) {
                console.error("❌ Renewal errors:", results.errors);
              }
            } catch (error) {
              console.error("❌ Error processing auto-renewals:", error);
            }

            // Wait a bit before expiring subscriptions
            setTimeout(async () => {
              console.log("⏰ Expiring subscriptions...");
              try {
                const results = await expireSubscriptions();
                console.log(`✅ Expired ${results.expired} subscriptions`);
              } catch (error) {
                console.error("❌ Error expiring subscriptions:", error);
              }
            }, 60000); // Wait 1 minute after renewals

            lastDailyRun = new Date();
          }
        },
        60 * 60 * 1000,
      ); // Check every hour

      console.log("⏰ Subscription renewal background jobs started");
    } catch (error) {
      console.warn(
        "⚠️ Could not setup subscription renewal jobs:",
        error.message,
      );
    }

    // Community subscription expiration checker (runs daily)
    try {
      let lastCommunityCheck = new Date(0);
      setInterval(
        async () => {
          const now = new Date();
          const hoursSinceLastCheck =
            (now - lastCommunityCheck) / (1000 * 60 * 60);

          // Run once per day (check hourly, execute only once)
          if (hoursSinceLastCheck >= 24) {
            console.log("🔄 Checking community subscription expirations...");
            try {
              const { checkAndProcessCommunitySubscriptions } =
                await import("./src/services/communitySubscriptionExpirationService.js");
              await checkAndProcessCommunitySubscriptions();
              console.log("✅ Community subscription check completed");
            } catch (error) {
              console.error(
                "❌ Error checking community subscriptions:",
                error,
              );
            }
            lastCommunityCheck = new Date();
          }
        },
        60 * 60 * 1000,
      ); // Check hourly

      console.log("⏰ Community subscription expiration checker started");
    } catch (error) {
      console.warn(
        "⚠️ Could not setup community subscription checker:",
        error.message,
      );
    }

    // Exchange rate update job (hourly; no startup burst — avoids pool stampede)
    try {
      const { runExchangeRateUpdate } =
        await import("./src/scripts/updateExchangeRates.js");

      scheduleBackgroundInterval(
        "exchange-rates",
        runExchangeRateUpdate,
        60 * 60 * 1000
      );

      console.log("⏰ Exchange rate update job started (hourly, serialized)");
    } catch (error) {
      console.warn(
        "⚠️ Could not setup exchange rate update job:",
        error.message,
      );
    }

    // Expired cart cleanup job (runs daily)
    try {
      const { cleanupExpiredCarts } =
        await import("./src/scripts/cleanupExpiredCarts.js");

      // Schedule daily cleanup (runs at 3 AM)
      let lastCartCleanup = new Date(0);
      setInterval(
        async () => {
          const now = new Date();
          const hoursSinceLastCleanup =
            (now - lastCartCleanup) / (1000 * 60 * 60);

          if (
            hoursSinceLastCleanup >= 24 &&
            now.getHours() >= 3 &&
            now.getHours() < 4
          ) {
            scheduleBackgroundJob("expired-cart-cleanup", async () => {
              console.log("🔄 Cleaning up expired guest carts...");
              await cleanupExpiredCarts();
              lastCartCleanup = new Date();
            });
          }
        },
        60 * 60 * 1000,
      );

      console.log("⏰ Expired cart cleanup job started (daily at 3 AM)");
    } catch (error) {
      console.warn(
        "⚠️ Could not setup expired cart cleanup job:",
        error.message,
      );
    }

    // Expire stale pending event ticket orders + send start reminders
    try {
      const { expireStalePendingOrders } = await import(
        "./src/services/eventTicketService.js"
      );
      const { sendDueEventReminders } = await import(
        "./src/services/eventReminderService.js"
      );
      setTimeout(() => {
        scheduleBackgroundInterval(
          "event-ticket-cleanup",
          expireStalePendingOrders,
          15 * 60 * 1000
        );
        scheduleBackgroundInterval(
          "event-ticket-reminders",
          sendDueEventReminders,
          15 * 60 * 1000
        );
        console.log(
          "⏰ Event ticket cleanup + reminders started (every 15 min, serialized)"
        );
      }, 10 * 60 * 1000);
    } catch (error) {
      console.warn(
        "⚠️ Could not setup event ticket reservation cleanup:",
        error.message
      );
    }

    // Active coaching session tracker: auto-ends sessions whose scheduled
    // time is up, sends 10/5-min warnings, and warns on low coaching-hours
    // balance. Was previously defined but never scheduled — sessions could
    // stay "active" (and billing hours) forever if a tutor forgot to end one.
    try {
      const { trackActiveSessions } = await import(
        "./src/services/coachingTimeTracker.js"
      );
      scheduleBackgroundInterval(
        "coaching-session-tracker",
        trackActiveSessions,
        60 * 1000
      );
      console.log("⏰ Coaching session tracker started (every 1 min, serialized)");
    } catch (error) {
      console.warn("⚠️ Could not setup coaching session tracker:", error.message);
    }

    // Product popularity score update job (runs daily)
    try {
      const { runProductPopularityUpdate } =
        await import("./src/scripts/updateProductPopularity.js");

      let lastPopularityUpdate = new Date(0);
      setInterval(
        async () => {
          const now = new Date();
          const hoursSinceLastUpdate =
            (now - lastPopularityUpdate) / (1000 * 60 * 60);

          if (
            hoursSinceLastUpdate >= 24 &&
            now.getHours() >= 2 &&
            now.getHours() < 3
          ) {
            scheduleBackgroundJob("product-popularity", async () => {
              console.log("🔄 Updating product popularity scores...");
              await runProductPopularityUpdate();
              lastPopularityUpdate = new Date();
            });
          }
        },
        60 * 60 * 1000,
      );

      console.log("⏰ Product popularity update job started (daily at 2 AM)");
    } catch (error) {
      console.warn(
        "⚠️ Could not setup product popularity update job:",
        error.message,
      );
    }
    } // end isPrimaryInstance (background jobs)

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log("📊 Connected to both LMS and Library databases");
    });
  } else {
    console.error("❌ Failed to connect to databases. Server not started.");
    process.exit(1);
  }
});

export default app;
