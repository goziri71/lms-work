/**
 * One-time fix: Reset the courses table auto-increment sequence.
 * Fixes "id must be unique" errors caused by out-of-sync sequence.
 * Run: node scripts/migrate-fix-courses-id-sequence.js
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
    console.log("✅ Connected to database");

    // Get current max id
    const [maxResult] = await db.query(
      `SELECT MAX(id) as max_id FROM courses`,
      { type: QueryTypes.SELECT }
    );
    const maxId = parseInt(maxResult.max_id) || 0;
    console.log(`📊 Current max course id: ${maxId}`);

    // Get current sequence value
    const [seqResult] = await db.query(
      `SELECT last_value FROM courses_id_seq`,
      { type: QueryTypes.SELECT }
    );
    console.log(`📊 Current sequence value: ${seqResult.last_value}`);

    if (parseInt(seqResult.last_value) >= maxId) {
      console.log("✅ Sequence is already in sync. No fix needed.");
      process.exit(0);
    }

    // Reset sequence to max id
    await db.query(
      `SELECT setval(pg_get_serial_sequence('courses', 'id'), (SELECT MAX(id) FROM courses))`,
      { type: QueryTypes.SELECT }
    );

    // Verify
    const [newSeqResult] = await db.query(
      `SELECT last_value FROM courses_id_seq`,
      { type: QueryTypes.SELECT }
    );
    console.log(`✅ Sequence reset to: ${newSeqResult.last_value}`);
    console.log("✅ Done. New courses will now get correct IDs.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fix failed:", err.message);
    console.error(err);
    process.exit(1);
  }
}

migrate();
