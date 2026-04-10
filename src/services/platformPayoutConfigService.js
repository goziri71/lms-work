import { PlatformPayoutConfig } from "../models/marketplace/platformPayoutConfig.js";

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Current NGN platform fee per NGN payout (row id=1 in platform_payout_config).
 * Fallback: env NGN_PAYOUT_PLATFORM_FEE, then 100, if table missing.
 */
export async function fetchNgnPlatformPayoutFee() {
  try {
    const row = await PlatformPayoutConfig.findByPk(1);
    if (row && row.ngn_payout_platform_fee != null) {
      const fee = num(row.ngn_payout_platform_fee);
      if (fee >= 0) return fee;
    }
  } catch (e) {
    console.warn("platform_payout_config read failed:", e.message);
  }
  const env = process.env.NGN_PAYOUT_PLATFORM_FEE;
  if (env === "0") return 0;
  if (env != null && String(env).trim() !== "") return num(env);
  return 100;
}
