import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Creates tutor_access_codes for super-admin single-use tutor access codes.
 *
 * Run: node scripts/migrate-create-tutor-access-codes.js
 */
async function migrate() {
  await db.authenticate();
  console.log("✅ Database connection OK.\n");

  const [exists] = await db.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tutor_access_codes'
    ) AS exists;`,
    { type: QueryTypes.SELECT },
  );

  if (exists.exists) {
    console.log("⚠️  tutor_access_codes already exists. Skipping.");
    await db.close();
    return;
  }

  await db.query(`
    CREATE TABLE tutor_access_codes (
      id SERIAL PRIMARY KEY,
      code_hash VARCHAR(64) NOT NULL UNIQUE,
      code_hint VARCHAR(8),
      status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked', 'redeemed')),
      valid_until TIMESTAMP,
      duration_months INTEGER NOT NULL DEFAULT 3,
      redeemed_at TIMESTAMP,
      redeemed_tutor_id INTEGER,
      redeemed_tutor_type VARCHAR(20)
        CHECK (redeemed_tutor_type IS NULL OR redeemed_tutor_type IN ('sole_tutor', 'organization')),
      created_by_admin_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE INDEX idx_tutor_access_codes_status ON tutor_access_codes (status);
  `);
  await db.query(`
    CREATE INDEX idx_tutor_access_codes_created_at ON tutor_access_codes (created_at);
  `);
  await db.query(`
    CREATE INDEX idx_tutor_access_codes_valid_until ON tutor_access_codes (valid_until);
  `);

  await db.query(`
    ALTER TABLE tutor_access_codes
      ADD CONSTRAINT fk_tutor_access_codes_admin
      FOREIGN KEY (created_by_admin_id) REFERENCES wsp_admins(id);
  `);

  console.log("✅ Created tutor_access_codes table.");
  await db.close();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
