import express from "express";
import cors from "cors";
import { connectDB } from "./src/database/database.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to database
connectDB().then((success) => {
  if (success) {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } else {
    console.error("Failed to connect to database. Server not started.");
    process.exit(1);
  }
});

export default app;
