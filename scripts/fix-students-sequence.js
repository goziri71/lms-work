import dotenv from "dotenv";
import { connectDB, db } from "../src/database/database.js";

dotenv.config();

/**
 * Fix students table sequence
 * This script resets the PostgreSQL sequence for the students.id column
 * to the maximum ID currently in the table + 1
 */
async function fixStudentsSequence() {
  try {
    console.log("📦 Starting sequence fix for students table...");

    // Connect to database
    await connectDB();
    console.log("✅ Database connection established");

    // Get the current maximum ID from the students table
    const [result] = await db.query(
      `SELECT MAX(id) as max_id FROM students`
    );

    const maxId = result[0]?.max_id || 0;
    const nextId = maxId + 1;

    console.log(`📊 Current maximum ID: ${maxId}`);
    console.log(`📊 Next ID should be: ${nextId}`);

    // Get the current sequence value
    const [seqResult] = await db.query(
      `SELECT last_value, is_called FROM students_id_seq`
    );

    const currentSeqValue = seqResult[0]?.last_value || 0;
    const isCalled = seqResult[0]?.is_called || false;

    console.log(`📊 Current sequence value: ${currentSeqValue} (is_called: ${isCalled})`);

    if (currentSeqValue < maxId) {
      console.log("⚠️  Sequence is out of sync! Fixing...");

      // Reset the sequence to the correct value
      await db.query(
        `SELECT setval('students_id_seq', ${nextId}, false)`
      );

      console.log(`✅ Sequence reset to: ${nextId}`);
    } else {
      console.log("✅ Sequence is already in sync");
    }

    // Verify the fix
    const [verifyResult] = await db.query(
      `SELECT last_value FROM students_id_seq`
    );
    console.log(`✅ Verified sequence value: ${verifyResult[0]?.last_value}`);

    console.log("✅ Sequence fix completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing sequence:", error);
    process.exit(1);
  }
}

fixStudentsSequence();

