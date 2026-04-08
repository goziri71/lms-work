/**
 * Sets coaching_settings.price_per_hour (video call / coaching hours credit) to 450 NGN.
 * Safe to re-run: updates the single settings row or creates defaults if missing.
 *
 * Usage: node scripts/set-coaching-video-call-price.js
 */

import dotenv from "dotenv";
import { db } from "../src/database/database.js";
import { CoachingSettings } from "../src/models/marketplace/coachingSettings.js";

dotenv.config();

const PRICE_PER_HOUR = 450;

async function main() {
  await db.authenticate();
  console.log("✅ DB connected\n");

  let settings = await CoachingSettings.findOne();
  if (!settings) {
    settings = await CoachingSettings.create({
      price_per_hour: PRICE_PER_HOUR,
      currency: "NGN",
      default_duration_minutes: 60,
      warning_threshold_minutes: 10,
      auto_end_enabled: true,
    });
    console.log(`Created coaching_settings: price_per_hour = ${PRICE_PER_HOUR} ${settings.currency}`);
  } else {
    await settings.update({ price_per_hour: PRICE_PER_HOUR });
    console.log(`Updated coaching_settings: price_per_hour = ${PRICE_PER_HOUR} ${settings.currency}`);
  }

  await db.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await db.close();
  } catch (_) {}
  process.exit(1);
});
