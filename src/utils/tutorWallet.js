/**
 * Legacy `wallet_balance` is kept in sync with `wallet_balance_primary` (local / non-USD-non-GBP bucket).
 * USD and GBP use dedicated columns only.
 *
 * @param {Record<string, unknown>} updates - Sequelize update payload (mutated)
 * @param {number} newPrimaryBalance - New wallet_balance_primary value
 */
export function applyLegacyWalletMirror(updates, newPrimaryBalance) {
  updates.wallet_balance = parseFloat(Number(newPrimaryBalance).toFixed(2));
}
