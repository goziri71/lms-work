/**
 * Migration: Add External File Storage System
 * Creates google_drive_connections and external_files tables
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function addExternalFiles() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: External File Storage System");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    // Step 1: Create google_drive_connections table
    console.log("🔍 Step 1: Creating 'google_drive_connections' table...");

    const [connectionsExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'google_drive_connections'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (connectionsExists.exists) {
      console.log("   ⏭️  'google_drive_connections' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE google_drive_connections (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL,
          tutor_type VARCHAR(20) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
          google_account_email VARCHAR(255),
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          token_expires_at TIMESTAMP,
          scope TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          last_sync_at TIMESTAMP,
          connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_tutor_google_drive UNIQUE (tutor_id, tutor_type)
        );
      `);

      // Create indexes
      await db.query(`
        CREATE UNIQUE INDEX idx_google_drive_connections_tutor ON google_drive_connections(tutor_id, tutor_type);
        CREATE INDEX idx_google_drive_connections_active ON google_drive_connections(is_active);
        CREATE INDEX idx_google_drive_connections_last_sync ON google_drive_connections(last_sync_at);
      `);

      console.log("   ✅ 'google_drive_connections' table created successfully.");
    }

    // Step 2: Create external_files table
    console.log("\n🔍 Step 2: Creating 'external_files' table...");

    const [filesExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'external_files'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (filesExists.exists) {
      console.log("   ⏭️  'external_files' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE external_files (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL,
          tutor_type VARCHAR(20) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
          google_drive_connection_id INTEGER,
          file_name VARCHAR(255) NOT NULL,
          file_type VARCHAR(100),
          file_size BIGINT,
          storage_type VARCHAR(20) NOT NULL DEFAULT 'google_drive' CHECK (storage_type IN ('google_drive', 'dropbox', 'onedrive', 'other')),
          external_file_id VARCHAR(255) NOT NULL,
          external_file_url TEXT,
          embed_url TEXT,
          thumbnail_url TEXT,
          folder_path TEXT,
          is_public BOOLEAN NOT NULL DEFAULT false,
          access_level VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (access_level IN ('public', 'private', 'restricted')),
          description TEXT,
          tags TEXT[],
          imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_accessed_at TIMESTAMP,
          status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_external_files_connection 
            FOREIGN KEY (google_drive_connection_id) 
            REFERENCES google_drive_connections(id) 
            ON DELETE SET NULL
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_external_files_tutor ON external_files(tutor_id, tutor_type);
        CREATE INDEX idx_external_files_connection ON external_files(google_drive_connection_id);
        CREATE INDEX idx_external_files_storage_type ON external_files(storage_type);
        CREATE INDEX idx_external_files_external_id ON external_files(external_file_id);
        CREATE INDEX idx_external_files_status ON external_files(status);
        CREATE INDEX idx_external_files_imported_at ON external_files(imported_at);
      `);

      console.log("   ✅ 'external_files' table created successfully.");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Set up Google Cloud Console project and OAuth credentials");
    console.log("   2. Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
    console.log("   3. Implement Google Drive OAuth flow");
    console.log("   4. Create bulk file import from Google Drive");
    console.log("   5. Implement file embedding and access control\n");

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

addExternalFiles();
