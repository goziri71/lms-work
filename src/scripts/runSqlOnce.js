import { dbLibrary } from "../database/database.js";

const sql = `
BEGIN;

-- Add title column to unit_notes if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='unit_notes' AND column_name='title'
  ) THEN
    ALTER TABLE unit_notes ADD COLUMN title VARCHAR(255) NULL;
  END IF;
END $$;

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
