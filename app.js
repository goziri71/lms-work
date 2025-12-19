import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
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
import { getProgramById, getFacultyById } from "./src/controllers/public/programFacultyController.js";
import { authorize } from "./src/middlewares/authorize.js";
import { setupAssociations } from "./src/models/associations.js";
import { setupExamAssociations } from "./src/models/exams/index.js";
import { setupDiscussionsSocket } from "./src/realtime/discussions.js";
import { setupDirectChatSocket } from "./src/realtime/directChat.js";
import { performanceMonitor } from "./src/middlewares/performanceMonitor.js";
import { trackLoginIP } from "./src/middlewares/ipTracker.js";
import { EmailLog } from "./src/models/email/emailLog.js";
import { db } from "./src/database/database.js";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
          await db.query('SELECT 1 FROM email_logs LIMIT 1');
          console.log("✅ email_logs table verified");
        } catch (verifyError) {
          console.warn("⚠️ email_logs table exists but may have issues:", verifyError.message);
        }
      }
    } catch (error) {
      console.error("⚠️ Warning: Could not verify/create email_logs table:", error.message);
      if (error.message.includes("USING") || error.message.includes("syntax")) {
        console.error("   This is likely a Sequelize sync issue. Trying alternative method...");
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
          console.error("❌ Fallback creation also failed:", fallbackError.message);
          console.error("   Please run 'node setup-email-logs-table.js' manually");
        }
      } else {
        console.error("   Run 'node setup-email-logs-table.js' manually to create the table");
      }
    }

    setupDiscussionsSocket(io);
    setupDirectChatSocket(io);
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
