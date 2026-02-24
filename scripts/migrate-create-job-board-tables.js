import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Migration script to create job board support tables.
 *
 * Creates:
 * 1) saved_jobs
 * 2) job_cache
 *
 * Run with:
 *   node scripts/migrate-create-job-board-tables.js
 */

async function tableExists(tableName) {
  const result = await db.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = :tableName
    ) AS exists;`,
    {
      type: QueryTypes.SELECT,
      replacements: { tableName },
    }
  );
  return !!result?.[0]?.exists;
}

async function createSavedJobsTable() {
  console.log("\n🔍 Step 1: Creating 'saved_jobs' table...");
  const exists = await tableExists("saved_jobs");
  if (exists) {
    console.log("⚠️  'saved_jobs' already exists. Skipping...");
    return;
  }

  await db.query(`
    CREATE TABLE saved_jobs (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      job_hash_id VARCHAR(255) NOT NULL,
      title VARCHAR(500) NOT NULL,
      employer VARCHAR(500),
      location VARCHAR(500),
      job_url TEXT,
      job_data JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_saved_job
    ON saved_jobs (student_id, job_hash_id);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_saved_jobs_student_id
    ON saved_jobs (student_id);
  `);

  console.log("✅ Created 'saved_jobs'");
}

async function createJobCacheTable() {
  console.log("\n🔍 Step 2: Creating 'job_cache' table...");
  const exists = await tableExists("job_cache");
  if (exists) {
    console.log("⚠️  'job_cache' already exists. Skipping...");
    return;
  }

  await db.query(`
    CREATE TABLE job_cache (
      id SERIAL PRIMARY KEY,
      cache_key VARCHAR(500) NOT NULL UNIQUE,
      search_params JSONB NOT NULL,
      response_data JSONB NOT NULL,
      total_results INTEGER,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_job_cache_key_unique
    ON job_cache (cache_key);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_job_cache_expires_at
    ON job_cache (expires_at);
  `);

  console.log("✅ Created 'job_cache'");
}

async function runMigration() {
  try {
    await db.authenticate();
    console.log("✅ Database connection established.");
    console.log("📦 Starting migration: Job board support tables");
    console.log(`Database dialect: ${db.getDialect()}`);

    await createSavedJobsTable();
    await createJobCacheTable();

    console.log("\n✅ Migration completed successfully.");
    console.log("\nRelevant endpoints:");
    console.log("  GET  /api/marketplace/jobs/search");
    console.log("  POST /api/marketplace/jobs/save");
    console.log("  GET  /api/marketplace/jobs/saved");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    process.exit(1);
  }
}

runMigration();

