/**
 * Renumber units so newest = 1 (top), oldest = N (bottom).
 * Run: node scripts/migrate-backfill-unit-order.js
 */

import dotenv from "dotenv";
import { connectDB, dbLibrary } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

dotenv.config({ debug: false });

async function run() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect");
      process.exit(1);
    }

    console.log("📦 Renumber units: newest=1 … oldest=N\n");

    // Newest created → order 1; oldest → highest
    await dbLibrary.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY module_id
            ORDER BY created_at DESC NULLS LAST, id DESC
          ) AS new_order
        FROM units
      )
      UPDATE units u
      SET "order" = ranked.new_order
      FROM ranked
      WHERE u.id = ranked.id;
    `);

    const sample = await dbLibrary.query(
      `
      SELECT module_id, id, title, "order", created_at
      FROM units
      WHERE module_id = 53
      ORDER BY "order" ASC
      `,
      { type: QueryTypes.SELECT }
    );

    console.log("Sample (1=newest at top):");
    console.log(sample);
    console.log("\n✅ Done");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed:", err);
    process.exit(1);
  }
}

run();
