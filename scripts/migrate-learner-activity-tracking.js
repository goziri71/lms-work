import { db } from "../src/database/database.js";

/**
 * Migration: Create learner activity tracking tables
 * This migration creates tables for tracking learner activities, course progress, and login history
 */

async function createLearnerActivityTrackingTables() {
  try {
    if (!db || !db.getDialect) {
      console.error("❌ Database connection not initialized. Please ensure connectDB() is called.");
      process.exit(1);
    }

    const dialect = db.getDialect();

    console.log("📦 Starting migration: Learner Activity Tracking Tables");
    console.log(`Database dialect: ${dialect}`);

    if (dialect === "postgres") {
      // Create learner_activity_logs table
      console.log("\n🔍 Step 1: Creating 'learner_activity_logs' table...");
      await db.query(`
        CREATE TABLE IF NOT EXISTS learner_activity_logs (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL,
          activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
            'login', 'logout', 'course_view', 'module_view', 'unit_view',
            'course_completed', 'module_completed', 'unit_completed',
            'quiz_attempt', 'exam_attempt', 'download', 'video_play', 'other'
          )),
          course_id INTEGER,
          module_id INTEGER,
          unit_id INTEGER,
          tutor_id INTEGER,
          tutor_type VARCHAR(50) CHECK (tutor_type IN ('sole_tutor', 'organization', 'wpu')),
          ip_address VARCHAR(45),
          location_country VARCHAR(100),
          location_city VARCHAR(100),
          device_type VARCHAR(50),
          browser VARCHAR(100),
          user_agent TEXT,
          duration_seconds INTEGER,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes for learner_activity_logs
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_learner_activity_student
        ON learner_activity_logs(student_id);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_learner_activity_tutor
        ON learner_activity_logs(tutor_id, tutor_type);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_learner_activity_course
        ON learner_activity_logs(course_id);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_learner_activity_type
        ON learner_activity_logs(activity_type);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_learner_activity_created
        ON learner_activity_logs(created_at);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_learner_activity_student_course
        ON learner_activity_logs(student_id, course_id);
      `);

      console.log("✅ 'learner_activity_logs' table created successfully");

      // Create course_progress table
      console.log("\n🔍 Step 2: Creating 'course_progress' table...");
      await db.query(`
        CREATE TABLE IF NOT EXISTS course_progress (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL,
          course_id INTEGER NOT NULL,
          tutor_id INTEGER,
          tutor_type VARCHAR(50) CHECK (tutor_type IN ('sole_tutor', 'organization', 'wpu')),
          total_modules INTEGER NOT NULL DEFAULT 0,
          completed_modules INTEGER NOT NULL DEFAULT 0,
          total_units INTEGER NOT NULL DEFAULT 0,
          viewed_units INTEGER NOT NULL DEFAULT 0,
          completion_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.0,
          is_completed BOOLEAN NOT NULL DEFAULT false,
          last_accessed_at TIMESTAMP,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          total_time_spent_seconds INTEGER NOT NULL DEFAULT 0,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_student_course UNIQUE (student_id, course_id)
        );
      `);

      // Create indexes for course_progress
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_course_progress_unique
        ON course_progress(student_id, course_id);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_course_progress_tutor
        ON course_progress(tutor_id, tutor_type);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_course_progress_course
        ON course_progress(course_id);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_course_progress_completed
        ON course_progress(is_completed);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_course_progress_last_accessed
        ON course_progress(last_accessed_at);
      `);

      console.log("✅ 'course_progress' table created successfully");

      // Create learner_login_history table
      console.log("\n🔍 Step 3: Creating 'learner_login_history' table...");
      await db.query(`
        CREATE TABLE IF NOT EXISTS learner_login_history (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL,
          ip_address VARCHAR(45) NOT NULL,
          location_country VARCHAR(100),
          location_city VARCHAR(100),
          location_region VARCHAR(100),
          location_latitude DECIMAL(10, 8),
          location_longitude DECIMAL(11, 8),
          device_type VARCHAR(50),
          browser VARCHAR(100),
          operating_system VARCHAR(100),
          user_agent TEXT,
          login_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          logout_at TIMESTAMP,
          session_duration_seconds INTEGER,
          is_active BOOLEAN NOT NULL DEFAULT true,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes for learner_login_history
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_learner_login_student
        ON learner_login_history(student_id);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_learner_login_ip
        ON learner_login_history(ip_address);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_learner_login_time
        ON learner_login_history(login_at);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_learner_login_active
        ON learner_login_history(is_active);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_learner_login_country
        ON learner_login_history(location_country);
      `);

      console.log("✅ 'learner_login_history' table created successfully");

    } else if (dialect === "mysql" || dialect === "mariadb") {
      // MySQL/MariaDB implementation
      console.log("\n🔍 Step 1: Creating 'learner_activity_logs' table...");
      await db.query(`
        CREATE TABLE IF NOT EXISTS learner_activity_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          student_id INT NOT NULL,
          activity_type ENUM(
            'login', 'logout', 'course_view', 'module_view', 'unit_view',
            'course_completed', 'module_completed', 'unit_completed',
            'quiz_attempt', 'exam_attempt', 'download', 'video_play', 'other'
          ) NOT NULL,
          course_id INT,
          module_id INT,
          unit_id INT,
          tutor_id INT,
          tutor_type ENUM('sole_tutor', 'organization', 'wpu'),
          ip_address VARCHAR(45),
          location_country VARCHAR(100),
          location_city VARCHAR(100),
          device_type VARCHAR(50),
          browser VARCHAR(100),
          user_agent TEXT,
          duration_seconds INT,
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_student (student_id),
          INDEX idx_tutor (tutor_id, tutor_type),
          INDEX idx_course (course_id),
          INDEX idx_type (activity_type),
          INDEX idx_created (created_at),
          INDEX idx_student_course (student_id, course_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      console.log("✅ 'learner_activity_logs' table created successfully");

      console.log("\n🔍 Step 2: Creating 'course_progress' table...");
      await db.query(`
        CREATE TABLE IF NOT EXISTS course_progress (
          id INT AUTO_INCREMENT PRIMARY KEY,
          student_id INT NOT NULL,
          course_id INT NOT NULL,
          tutor_id INT,
          tutor_type ENUM('sole_tutor', 'organization', 'wpu'),
          total_modules INT NOT NULL DEFAULT 0,
          completed_modules INT NOT NULL DEFAULT 0,
          total_units INT NOT NULL DEFAULT 0,
          viewed_units INT NOT NULL DEFAULT 0,
          completion_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.0,
          is_completed BOOLEAN NOT NULL DEFAULT false,
          last_accessed_at TIMESTAMP,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          total_time_spent_seconds INT NOT NULL DEFAULT 0,
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_student_course (student_id, course_id),
          INDEX idx_tutor (tutor_id, tutor_type),
          INDEX idx_course (course_id),
          INDEX idx_completed (is_completed),
          INDEX idx_last_accessed (last_accessed_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      console.log("✅ 'course_progress' table created successfully");

      console.log("\n🔍 Step 3: Creating 'learner_login_history' table...");
      await db.query(`
        CREATE TABLE IF NOT EXISTS learner_login_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          student_id INT NOT NULL,
          ip_address VARCHAR(45) NOT NULL,
          location_country VARCHAR(100),
          location_city VARCHAR(100),
          location_region VARCHAR(100),
          location_latitude DECIMAL(10, 8),
          location_longitude DECIMAL(11, 8),
          device_type VARCHAR(50),
          browser VARCHAR(100),
          operating_system VARCHAR(100),
          user_agent TEXT,
          login_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          logout_at TIMESTAMP,
          session_duration_seconds INT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_student (student_id),
          INDEX idx_ip (ip_address),
          INDEX idx_time (login_at),
          INDEX idx_active (is_active),
          INDEX idx_country (location_country)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      console.log("✅ 'learner_login_history' table created successfully");
    } else {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
createLearnerActivityTrackingTables();

