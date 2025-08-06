import express from "express";
import cors from "cors";
import { connectDB } from "./src/database/database.js";
import authRoutes from "./src/routes/auth.js";
import { setupAssociations } from "./src/models/associations.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);

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

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log("📊 Connected to both LMS and Library databases");
    });
  } else {
    console.error("❌ Failed to connect to databases. Server not started.");
    process.exit(1);
  }
});

export default app;
