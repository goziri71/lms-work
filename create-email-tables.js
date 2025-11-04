import { connectDB, db } from "./src/database/database.js";
import { EmailLog } from "./src/models/email/emailLog.js";
import { EmailPreference } from "./src/models/email/emailPreference.js";

/**
 * Create email tables in the database
 * Run this script with: node create-email-tables.js
 */
async function createEmailTables() {
  try {
    console.log("🔄 Connecting to database...");
    const connected = await connectDB();

    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("🔄 Creating email tables...");

    // Create email_logs table
    await EmailLog.sync({ force: false, alter: true });
    console.log("✅ email_logs table created/updated successfully");

    // Create email_preferences table
    await EmailPreference.sync({ force: false, alter: true });
    console.log("✅ email_preferences table created/updated successfully");

    console.log("\n🎉 Email tables setup completed successfully!");
    console.log("\n📋 Tables created:");
    console.log("   - email_logs (tracks all sent emails)");
    console.log("   - email_preferences (user notification settings)");
    console.log("\n💡 Next steps:");
    console.log("   1. Test registration endpoint to verify welcome emails");
    console.log("   2. Test password reset flow");
    console.log("   3. Check email_logs table to see sent emails");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating email tables:", error);
    process.exit(1);
  }
}

createEmailTables();

