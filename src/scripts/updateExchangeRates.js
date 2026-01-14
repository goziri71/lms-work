/**
 * Cron Job: Update Exchange Rates
 * Runs hourly to fetch and update exchange rates from external API
 * 
 * Usage:
 * - Add to app.js: import { updateExchangeRates } from './src/scripts/updateExchangeRates.js';
 * - Schedule: setInterval(() => updateExchangeRates(), 60 * 60 * 1000); // Every hour
 */

import { updateExchangeRates } from "../services/currencyExchangeRateService.js";

/**
 * Update exchange rates (can be called directly or via cron)
 */
export async function runExchangeRateUpdate() {
  try {
    console.log("🔄 Starting exchange rate update job...");
    const result = await updateExchangeRates();
    
    if (result.success) {
      console.log(`✅ Exchange rate update completed: ${result.updated} rates updated`);
      return result;
    } else {
      console.error(`❌ Exchange rate update failed: ${result.error}`);
      return result;
    }
  } catch (error) {
    console.error("❌ Exchange rate update error:", error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date(),
    };
  }
}

// If run directly (for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  runExchangeRateUpdate()
    .then((result) => {
      console.log("Result:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
