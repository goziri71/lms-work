/**
 * One-time migration: Set communities_limit on tutor_subscriptions to match tier defaults.
 * Professional -> 3, Expert -> 5 (Basic stays 1, Grand Master stays null).
 * Run: node scripts/migrate-community-limits-by-tier.js
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function migrate() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ Database connected.");
    console.log(
      "📦 Migration: Sync communities_limit for professional (3) and expert (5)\n"
    );

    await db.query(
      `UPDATE tutor_subscriptions SET communities_limit = 3 WHERE subscription_tier = 'professional' AND (communities_limit IS NULL OR communities_limit != 3)`,
      { type: QueryTypes.UPDATE }
    );

    await db.query(
      `UPDATE tutor_subscriptions SET communities_limit = 5 WHERE subscription_tier = 'expert' AND (communities_limit IS NULL OR communities_limit != 5)`,
      { type: QueryTypes.UPDATE }
    );

    console.log(
      "✅ Professional: communities_limit set to 3 where applicable."
    );
    console.log("✅ Expert: communities_limit set to 5 where applicable.");
    console.log("✅ Done.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

migrate();
