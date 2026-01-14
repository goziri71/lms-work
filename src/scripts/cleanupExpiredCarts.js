/**
 * Cron Job: Cleanup Expired Guest Carts
 * Runs daily to mark expired guest carts (older than 2 days) as expired
 * 
 * Usage:
 * - Add to app.js: import { cleanupExpiredCarts } from './src/scripts/cleanupExpiredCarts.js';
 * - Schedule: setInterval(() => cleanupExpiredCarts(), 24 * 60 * 60 * 1000); // Daily
 */

import { StoreCart } from "../models/marketplace/storeCart.js";
import { Op } from "sequelize";

/**
 * Cleanup expired guest carts (older than 2 days)
 */
export async function cleanupExpiredCarts() {
  try {
    console.log("🔄 Starting expired cart cleanup...");

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Find expired guest carts
    const expiredCarts = await StoreCart.findAll({
      where: {
        user_id: null, // Guest carts only
        session_id: { [Op.ne]: null },
        status: "active",
        expires_at: {
          [Op.lt]: new Date(), // Expired
        },
      },
    });

    if (expiredCarts.length === 0) {
      console.log("✅ No expired carts to cleanup");
      return {
        success: true,
        expired: 0,
        timestamp: new Date(),
      };
    }

    // Mark as expired
    const expiredIds = expiredCarts.map((cart) => cart.id);
    await StoreCart.update(
      { status: "expired" },
      {
        where: {
          id: { [Op.in]: expiredIds },
        },
      }
    );

    console.log(`✅ Marked ${expiredCarts.length} expired carts`);

    return {
      success: true,
      expired: expiredCarts.length,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("❌ Error cleaning up expired carts:", error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date(),
    };
  }
}

// If run directly (for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupExpiredCarts()
    .then((result) => {
      console.log("Result:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
