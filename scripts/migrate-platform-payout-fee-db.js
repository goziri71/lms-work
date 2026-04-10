import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * 1) platform_payout_config — singleton fee (id = 1)
 * 2) tutor_payouts.platform_payout_fee — snapshot per payout
 *
 * Run: node scripts/migrate-platform-payout-fee-db.js
 */

async function migrate() {
  await db.authenticate();
  console.log("✅ DB connected\n📦 migrate-platform-payout-fee-db\n");

  await db.query(`
    CREATE TABLE IF NOT EXISTS platform_payout_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      ngn_payout_platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✅ platform_payout_config table ready");

  const rows = await db.query(`SELECT id FROM platform_payout_config WHERE id = 1`, {
    type: QueryTypes.SELECT,
  });
  const exists = Array.isArray(rows) && rows.length > 0;
  if (!exists) {
    await db.query(
      `INSERT INTO platform_payout_config (id, ngn_payout_platform_fee) VALUES (1, 100.00)`
    );
    console.log("✅ Seeded platform_payout_config id=1 (100 NGN)");
  } else {
    console.log("⏭️  platform_payout_config row id=1 already exists");
  }

  const col = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tutor_payouts' AND column_name = 'platform_payout_fee'`,
    { type: QueryTypes.SELECT }
  );
  const hasCol = Array.isArray(col) && col.length > 0;
  if (!hasCol) {
    await db.query(`
      ALTER TABLE tutor_payouts
      ADD COLUMN platform_payout_fee DECIMAL(10, 2) NULL
    `);
    await db.query(`
      COMMENT ON COLUMN tutor_payouts.platform_payout_fee IS 'NGN platform fee snapshot (from platform_payout_config at request time)';
    `);
    console.log("✅ tutor_payouts.platform_payout_fee added");
  } else {
    console.log("⏭️  tutor_payouts.platform_payout_fee exists");
  }

  console.log("\n✅ Done.");
  await db.close();
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
