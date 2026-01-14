/**
 * Cron Job: Update Product Popularity Scores
 * Runs daily to recalculate popularity scores for all products
 * 
 * Usage:
 * - Add to app.js: import { updateAllProductPopularity } from './src/services/productPopularityService.js';
 * - Schedule: setInterval(() => updateAllProductPopularity(), 24 * 60 * 60 * 1000); // Daily
 */

import { updateAllProductPopularity } from "../services/productPopularityService.js";

/**
 * Run popularity score update
 */
export async function runProductPopularityUpdate() {
  try {
    console.log("🔄 Starting product popularity score update...");
    const result = await updateAllProductPopularity();
    return result;
  } catch (error) {
    console.error("❌ Error updating product popularity:", error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date(),
    };
  }
}

// If run directly (for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  runProductPopularityUpdate()
    .then((result) => {
      console.log("Result:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
