import { connectDB, db } from "./src/database/database.js";
import { EmailLog } from "./src/models/email/emailLog.js";

/**
 * Setup Email Logs Table
 * Creates the email_logs table if it doesn't exist
 * 
 * Run with: node setup-email-logs-table.js
 */

async function setupEmailLogsTable() {
  try {
    console.log("🔄 Connecting to database...");
    const connected = await connectDB();

    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("\n📋 Setting up Email Logs Table...\n");

    // Check if table exists
    const checkTable = async (tableName) => {
      const [result] = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${tableName}'
        )`
      );
      return result[0].exists;
    };

    console.log("🔄 Checking email_logs table...");
    const emailLogsExists = await checkTable("email_logs");

    if (!emailLogsExists) {
      console.log("   Creating email_logs table...");
      try {
        await EmailLog.sync({ force: false });
        console.log("   ✅ email_logs table created successfully");
      } catch (syncError) {
        console.warn("   ⚠️ Sequelize sync failed, trying raw SQL...");
        // Fallback: Create table using raw SQL
        await db.query(`
          CREATE TABLE IF NOT EXISTS email_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            user_type VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (user_type IN ('student', 'staff', 'other')),
            recipient_email VARCHAR(255) NOT NULL,
            recipient_name VARCHAR(255),
            email_type VARCHAR(50) NOT NULL CHECK (email_type IN ('welcome', 'password_reset', 'email_verification', 'course_enrollment', 'exam_reminder', 'exam_published', 'grade_notification', 'quiz_deadline', 'announcement', 'other')),
            subject VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
            zepto_message_id VARCHAR(255),
            error_message TEXT,
            sent_at TIMESTAMP,
            metadata JSONB,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id, user_type);
          CREATE INDEX IF NOT EXISTS idx_email_logs_email ON email_logs(recipient_email);
          CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
          CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
          CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);
        `);
        console.log("   ✅ email_logs table created using raw SQL");
      }
    } else {
      console.log("   ✅ email_logs table already exists");
      // Just verify it's accessible, don't alter (can cause errors)
      try {
        await db.query('SELECT 1 FROM email_logs LIMIT 1');
        console.log("   ✅ email_logs table is accessible");
      } catch (verifyError) {
        console.warn("   ⚠️ Table exists but may have issues:", verifyError.message);
      }
    }

    // Verify table structure
    console.log("\n🔍 Verifying table structure...");
    const [columns] = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'email_logs'
      ORDER BY ordinal_position
    `);
    
    console.log("\n📊 Table columns:");
    columns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    console.log("\n🎉 Email logs table setup completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting up email_logs table:", error);
    console.error("Full error:", error);
    process.exit(1);
  }
}

setupEmailLogsTable();

