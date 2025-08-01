import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { Config } from "../config/config.js";

dotenv.config();

const db = new Sequelize(
  Config.database.name,
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

export async function connectDB() {
  try {
    await db.authenticate();
    console.log("😎 Database connection established successfully.");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    return false;
  }
}

export { db };
