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
      await EmailLog.sync({ force: false });
      console.log("   ✅ email_logs table created successfully");
    } else {
      console.log("   ✅ email_logs table already exists");
      // Still sync to ensure schema is up to date
      console.log("   🔄 Syncing table schema...");
      await EmailLog.sync({ alter: true });
      console.log("   ✅ email_logs table schema updated");
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

