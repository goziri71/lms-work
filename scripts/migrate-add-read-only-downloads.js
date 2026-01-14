/**
 * Migration: Add Read-Only Digital Downloads Feature
 * Adds is_read_only flag to digital_downloads and creates read_sessions table
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function addReadOnlyDownloads() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Read-Only Digital Downloads");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    // Step 1: Add is_read_only column to digital_downloads
    console.log("🔍 Step 1: Adding 'is_read_only' column to 'digital_downloads' table...");

    const [readOnlyExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'digital_downloads' 
        AND column_name = 'is_read_only'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (readOnlyExists.exists) {
      console.log("   ⏭️  'is_read_only' column already exists. Skipping...");
    } else {
      await db.query(`
        ALTER TABLE digital_downloads
        ADD COLUMN is_read_only BOOLEAN NOT NULL DEFAULT false;
      `);

      await db.query(`
        CREATE INDEX idx_digital_downloads_read_only ON digital_downloads(is_read_only);
      `);

      console.log("   ✅ Added 'is_read_only' column to 'digital_downloads'.");
    }

    // Step 2: Ensure download_enabled has a default value
    console.log("\n🔍 Step 2: Verifying 'download_enabled' column...");

    const [downloadEnabledExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'digital_downloads' 
        AND column_name = 'download_enabled'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (downloadEnabledExists.exists) {
      // Check if it has a default value
      const [columnInfo] = await db.query(
        `SELECT column_default 
         FROM information_schema.columns 
         WHERE table_name = 'digital_downloads' 
         AND column_name = 'download_enabled';`,
        { type: QueryTypes.SELECT }
      );

      if (!columnInfo || !columnInfo.column_default) {
        await db.query(`
          ALTER TABLE digital_downloads
          ALTER COLUMN download_enabled SET DEFAULT true;
        `);
        console.log("   ✅ Set default value for 'download_enabled' column.");
      } else {
        console.log("   ⏭️  'download_enabled' already has a default value. Skipping...");
      }
    } else {
      await db.query(`
        ALTER TABLE digital_downloads
        ADD COLUMN download_enabled BOOLEAN NOT NULL DEFAULT true;
      `);
      console.log("   ✅ Added 'download_enabled' column to 'digital_downloads'.");
    }

    // Step 3: Create read_sessions table
    console.log("\n🔍 Step 3: Creating 'read_sessions' table...");

    const [sessionsExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'read_sessions'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (sessionsExists.exists) {
      console.log("   ⏭️  'read_sessions' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE read_sessions (
          id SERIAL PRIMARY KEY,
          digital_download_id INTEGER NOT NULL,
          student_id INTEGER NOT NULL,
          current_page INTEGER NOT NULL DEFAULT 1,
          total_pages INTEGER,
          progress_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.0,
          last_read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          session_token VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_download_student_session UNIQUE (digital_download_id, student_id),
          CONSTRAINT fk_read_sessions_download 
            FOREIGN KEY (digital_download_id) 
            REFERENCES digital_downloads(id) 
            ON DELETE CASCADE,
          CONSTRAINT fk_read_sessions_student 
            FOREIGN KEY (student_id) 
            REFERENCES students(id) 
            ON DELETE CASCADE
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_read_sessions_download ON read_sessions(digital_download_id);
        CREATE INDEX idx_read_sessions_student ON read_sessions(student_id);
        CREATE INDEX idx_read_sessions_token ON read_sessions(session_token);
        CREATE INDEX idx_read_sessions_expires ON read_sessions(expires_at);
      `);

      console.log("   ✅ 'read_sessions' table created successfully.");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update DigitalDownloads model to include is_read_only field");
    console.log("   2. Create read session controller (create, update progress)");
    console.log("   3. Create PDF viewer endpoint (stream with security headers)");
    console.log("   4. Implement reading progress tracking\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    process.exit(1);
  }
}

addReadOnlyDownloads();
