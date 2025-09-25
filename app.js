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
import { setupAssociations } from "./src/models/associations.js";
import { setupDiscussionsSocket } from "./src/realtime/discussions.js";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/students", studentRoutes);
app.use("/api", modulesRoutes);

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
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Connect to databases
connectDB().then((success) => {
  if (success) {
    // Set up model associations after database connection
    setupAssociations();
    console.log("🔗 Model associations established");

    setupDiscussionsSocket(io);
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
