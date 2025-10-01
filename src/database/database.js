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
      await mongoose.connect(mongoUri);
      console.log("✅ MongoDB connection established successfully.");
    } else {
      console.warn(
        "⚠️  MONGO_URI not set. Chat features will be disabled until configured."
      );
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
