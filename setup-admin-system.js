import { connectDB, db } from "./src/database/database.js";
import { WspAdmin } from "./src/models/admin/wspAdmin.js";
import { AdminActivityLog } from "./src/models/admin/adminActivityLog.js";
import { authService } from "./src/service/authservice.js";

/**
 * Setup WSP Admin System
 * 
 * This script:
 * 1. Creates admin tables (wsp_admins, admin_activity_logs)
 * 2. Creates first super admin account
 * 
 * Run with: node setup-admin-system.js
 */

async function setupAdminSystem() {
  try {
    console.log("🔄 Connecting to database...");
    const connected = await connectDB();

    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("\n📋 Setting up WSP Admin System...\n");

    // Create admin tables (only if they don't exist)
    console.log("🔄 Checking wsp_admins table...");
    const wspAdminsExists = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'wsp_admins'
      )`,
      { type: db.QueryTypes.SELECT }
    );

    if (!wspAdminsExists[0].exists) {
      await WspAdmin.sync({ force: false });
      console.log("✅ wsp_admins table created");
    } else {
      console.log("✅ wsp_admins table already exists");
    }

    console.log("🔄 Checking admin_activity_logs table...");
    const activityLogsExists = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_activity_logs'
      )`,
      { type: db.QueryTypes.SELECT }
    );

    if (!activityLogsExists[0].exists) {
      await AdminActivityLog.sync({ force: false });
      console.log("✅ admin_activity_logs table created");
    } else {
      console.log("✅ admin_activity_logs table already exists");
    }

    // Check if super admin already exists
    const existingSuperAdmin = await WspAdmin.findOne({
      where: { role: "super_admin" },
    });

    if (existingSuperAdmin) {
      console.log("\n⚠️  Super admin already exists!");
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Name: ${existingSuperAdmin.fname} ${existingSuperAdmin.lname}`);
      console.log("\n💡 To create additional admins, login and use the admin panel.");
    } else {
      // Create first super admin
      console.log("\n🔄 Creating first super admin account...");
      
      // Default credentials (CHANGE THESE!)
      const superAdminData = {
        email: "admin@pinnacleuniversity.co",
        password: "Admin@123456", // CHANGE THIS IMMEDIATELY!
        fname: "Super",
        lname: "Admin",
        role: "super_admin",
        permissions: {
          students: { view: true, create: true, edit: true, delete: true },
          staff: { view: true, create: true, edit: true, delete: true },
          courses: { view: true, create: true, edit: true, delete: true },
          content: { modules: true, units: true, quizzes: true, exams: true },
          admins: { view: true, create: true, edit: true, delete: true },
          system: { settings: true, analytics: true, logs: true },
        },
        status: "active",
      };

      const hashedPassword = authService.hashPassword(superAdminData.password);

      const superAdmin = await WspAdmin.create({
        ...superAdminData,
        password: hashedPassword,
      });

      console.log("✅ Super admin created successfully!\n");
      console.log("═══════════════════════════════════════════");
      console.log("📧 LOGIN CREDENTIALS (CHANGE IMMEDIATELY!)");
      console.log("═══════════════════════════════════════════");
      console.log(`Email:    ${superAdminData.email}`);
      console.log(`Password: ${superAdminData.password}`);
      console.log("═══════════════════════════════════════════\n");
      console.log("⚠️  IMPORTANT SECURITY NOTICE:");
      console.log("   1. Login immediately and change the password!");
      console.log("   2. Use a strong, unique password");
      console.log("   3. Enable 2FA if available");
      console.log("   4. Never share admin credentials\n");
    }

    // Summary
    console.log("\n📊 Admin System Summary:");
    const totalAdmins = await WspAdmin.count();
    const superAdmins = await WspAdmin.count({ where: { role: "super_admin" } });
    const wspAdmins = await WspAdmin.count({ where: { role: "wsp_admin" } });
    const activeAdmins = await WspAdmin.count({ where: { status: "active" } });

    console.log(`   Total Admins: ${totalAdmins}`);
    console.log(`   Super Admins: ${superAdmins}`);
    console.log(`   WSP Admins: ${wspAdmins}`);
    console.log(`   Active: ${activeAdmins}`);

    console.log("\n✅ Admin system setup completed successfully!");
    console.log("\n📝 Next Steps:");
    console.log("   1. Start your server: npm run dev");
    console.log("   2. Admin login endpoint: POST /api/admin/login");
    console.log("   3. Change default super admin password immediately!");
    console.log("   4. Create additional WSP admins as needed\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error setting up admin system:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

setupAdminSystem();

