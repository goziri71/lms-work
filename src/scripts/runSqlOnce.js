import { dbLibrary } from "../database/database.js";

const sql = `
BEGIN;

-- Drop unique constraint to allow multiple notes per student per module
ALTER TABLE unit_notes DROP CONSTRAINT IF EXISTS uq_module_notes;

COMMIT;
`;

(async () => {
  try {
    console.log("Running unit_notes -> module_id migration...");
    await dbLibrary.query(sql);
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  } finally {
    await dbLibrary.close();
  }
})();
