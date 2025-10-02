import { Sequelize } from "sequelize";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Config } from "../config/config.js";

dotenv.config({ debug: false });

const db = new Sequelize(
  Config.database.url || Config.database.name,
  Config.database.username,
  Config.database.password,
  {
    host: Config.database.host,
    dialect: Config.database.dialect,
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    dialectOptions: Config.database.dialectOptions,
    pool: Config.database.pool,
  }
);

const dbLibrary = new Sequelize(
  Config.databaseLibrary.name,
  Config.databaseLibrary.username,
  Config.databaseLibrary.password,
  {
    host: Config.databaseLibrary.host,
    dialect: Config.databaseLibrary.dialect,
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    dialectOptions: Config.databaseLibrary.dialectOptions,
    pool: Config.databaseLibrary.pool,
  }
);

export async function connectDB() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");

    await dbLibrary.authenticate();
    console.log("✅ Library Database connection established successfully.");

    // Connect MongoDB (for chat)
    const mongoUri = process.env.MONGO_URI;
    if (mongoUri) {
      try {
        await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 10000, // 10 second timeout
          socketTimeoutMS: 45000,
          maxPoolSize: 10,
          minPoolSize: 2,
        });
        console.log("✅ MongoDB connection established successfully.");
        console.log(`   Database: ${mongoose.connection.db.databaseName}`);
      } catch (mongoError) {
        console.error("❌ MongoDB connection failed:", mongoError.message);
        console.error(
          "   Make sure MONGO_URI is correct and IP is whitelisted in MongoDB Atlas"
        );
        throw new Error("MongoDB connection required for chat features");
      }
    } else {
      console.error("❌ MONGO_URI not set in .env");
      throw new Error("MONGO_URI required for chat features");
    }

    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    if (process.env.NODE_ENV === "development") {
      console.error("🔍 Full error details:", error);
    }
    return false;
  }
}

export { db, dbLibrary };
