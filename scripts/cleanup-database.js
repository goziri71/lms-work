import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import readline from "readline";
import { Config } from "../src/config/config.js";

dotenv.config({ debug: false });

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Database connection
const db = new Sequelize(
  Config.database.url || Config.database.name,
  Config.database.username,
  Config.database.password,
  {
    host: Config.database.host,
    dialect: Config.database.dialect,
    logging: false, // Disable query logging
    dialectOptions: Config.database.dialectOptions,
    pool: Config.database.pool,
  }
);

// Helper function to ask user for confirmation
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().trim());
    });
  });
}

// Helper function to check if a field has single quotes
async function checkField(table, field, condition = "") {
  try {
    const [results] = await db.query(`
      SELECT COUNT(*) as count
      FROM ${table}
      WHERE ${field} IS NOT NULL 
        AND ${field} LIKE '%''%'
        ${condition ? `AND ${condition}` : ""}
    `);
    return parseInt(results[0].count);
  } catch (error) {
    // Table or column might not exist, return 0
    return 0;
  }
}

// Helper function to clean a field
async function cleanField(table, field, transaction) {
  try {
    let updateQuery;
    
    if (field === "email") {
      // For emails: remove quotes, trim, and lowercase
      updateQuery = `
        UPDATE ${table}
        SET ${field} = LOWER(TRIM(REPLACE(${field}, '''', '')))
        WHERE ${field} IS NOT NULL AND ${field} LIKE '%''%'
      `;
    } else if (field === "password") {
      // For passwords: only remove quotes (don't trim or lowercase)
      updateQuery = `
        UPDATE ${table}
        SET ${field} = REPLACE(${field}, '''', '')
        WHERE ${field} IS NOT NULL AND ${field} LIKE '%''%'
      `;
    } else {
      // For other fields: remove quotes and trim
      updateQuery = `
        UPDATE ${table}
        SET ${field} = TRIM(REPLACE(${field}, '''', ''))
        WHERE ${field} IS NOT NULL AND ${field} LIKE '%''%'
      `;
    }

    const [result] = await db.query(updateQuery, { transaction });
    return result.rowCount || 0;
  } catch (error) {
    // Table or column might not exist, return 0
    if (error.message.includes("does not exist") || error.message.includes("column")) {
      return 0;
    }
    throw error;
  }
}

// Check what needs cleaning
async function checkDatabase() {
  console.log("\n🔍 Checking database for single quotes...\n");

  const checks = [
    { table: "students", fields: ["email", "password", "fname", "lname", "mname", "phone", "matric_number", "address", "application_code", "referral_code", "token", "gender", "dob", "file", "admin_status", "g_status", "level", "a_status", "study_mode", "teller_no", "account_no", "account_name", "bank", "currency", "certificate_file", "birth_certificate", "ref_letter", "valid_id", "resume_cv", "other_file", "school1_date", "school2", "school2_date", "application_fee"] },
    { table: "staff", fields: ["email", "password", "full_name", "phone", "token"] },
    { table: "wsp_admins", fields: ["email", "password", "fname", "lname", "mname", "phone", "token", "password_reset_token"] },
    { table: "courses", fields: ["title", "course_code", "token"] },
    { table: "organizations", fields: ["email", "password", "name", "phone"] },
    { table: "sole_tutors", fields: ["email", "password", "fname", "lname", "phone"] },
    { table: "organization_users", fields: ["email", "password", "fname", "lname", "phone"] },
  ];

  const summary = [];
  let totalRecords = 0;

  for (const { table, fields } of checks) {
    let tableTotal = 0;
    const fieldCounts = {};

    for (const field of fields) {
      const count = await checkField(table, field);
      if (count > 0) {
        fieldCounts[field] = count;
        tableTotal += count;
      }
    }

    if (tableTotal > 0) {
      summary.push({ table, fields: fieldCounts, total: tableTotal });
      totalRecords += tableTotal;
    }
  }

  return { summary, totalRecords };
}

// Clean the database
async function cleanDatabase() {
  console.log("\n🧹 Starting database cleanup...\n");

  const cleanupTasks = [
    // Students - All string fields
    { table: "students", field: "email" },
    { table: "students", field: "password" },
    { table: "students", field: "fname" },
    { table: "students", field: "lname" },
    { table: "students", field: "mname" },
    { table: "students", field: "phone" },
    { table: "students", field: "matric_number" },
    { table: "students", field: "address" },
    { table: "students", field: "application_code" },
    { table: "students", field: "referral_code" },
    { table: "students", field: "token" },
    { table: "students", field: "state_origin" },
    { table: "students", field: "country" },
    { table: "students", field: "lcda" },
    { table: "students", field: "gender" },
    { table: "students", field: "dob" },
    { table: "students", field: "file" },
    { table: "students", field: "admin_status" },
    { table: "students", field: "g_status" },
    { table: "students", field: "level" },
    { table: "students", field: "a_status" },
    { table: "students", field: "study_mode" },
    { table: "students", field: "teller_no" },
    { table: "students", field: "account_no" },
    { table: "students", field: "account_name" },
    { table: "students", field: "bank" },
    { table: "students", field: "currency" },
    { table: "students", field: "certificate_file" },
    { table: "students", field: "birth_certificate" },
    { table: "students", field: "ref_letter" },
    { table: "students", field: "valid_id" },
    { table: "students", field: "resume_cv" },
    { table: "students", field: "other_file" },
    { table: "students", field: "school1_date" },
    { table: "students", field: "school2" },
    { table: "students", field: "school2_date" },
    { table: "students", field: "application_fee" },

    // Staff
    { table: "staff", field: "email" },
    { table: "staff", field: "password" },
    { table: "staff", field: "full_name" },
    { table: "staff", field: "phone" },
    { table: "staff", field: "linkedin" },
    { table: "staff", field: "google_scholar" },
    { table: "staff", field: "research_areas" },
    { table: "staff", field: "home_address" },
    { table: "staff", field: "token" },

    // WSP Admins
    { table: "wsp_admins", field: "email" },
    { table: "wsp_admins", field: "password" },
    { table: "wsp_admins", field: "fname" },
    { table: "wsp_admins", field: "lname" },
    { table: "wsp_admins", field: "mname" },
    { table: "wsp_admins", field: "phone" },
    { table: "wsp_admins", field: "token" },
    { table: "wsp_admins", field: "password_reset_token" },
    { table: "wsp_admins", field: "two_factor_secret" },
    { table: "wsp_admins", field: "profile_image" },

    // Courses
    { table: "courses", field: "title" },
    { table: "courses", field: "course_code" },
    { table: "courses", field: "token" },
    { table: "courses", field: "price" },
    { table: "courses", field: "course_type" },
    { table: "courses", field: "semester" },
    { table: "courses", field: "currency" },

    // Organizations
    { table: "organizations", field: "email" },
    { table: "organizations", field: "password" },
    { table: "organizations", field: "name" },
    { table: "organizations", field: "phone" },
    { table: "organizations", field: "website" },
    { table: "organizations", field: "address" },
    { table: "organizations", field: "country" },
    { table: "organizations", field: "registration_number" },
    { table: "organizations", field: "tax_id" },
    { table: "organizations", field: "logo" },
    { table: "organizations", field: "password_reset_token" },

    // Sole Tutors
    { table: "sole_tutors", field: "email" },
    { table: "sole_tutors", field: "password" },
    { table: "sole_tutors", field: "fname" },
    { table: "sole_tutors", field: "lname" },
    { table: "sole_tutors", field: "mname" },
    { table: "sole_tutors", field: "phone" },
    { table: "sole_tutors", field: "specialization" },
    { table: "sole_tutors", field: "profile_image" },
    { table: "sole_tutors", field: "password_reset_token" },

    // Organization Users
    { table: "organization_users", field: "email" },
    { table: "organization_users", field: "password" },
    { table: "organization_users", field: "fname" },
    { table: "organization_users", field: "lname" },
    { table: "organization_users", field: "mname" },
    { table: "organization_users", field: "phone" },
    { table: "organization_users", field: "password_reset_token" },
  ];

  let totalCleaned = 0;
  const transaction = await db.transaction();

  try {
    for (const task of cleanupTasks) {
      try {
        const cleaned = await cleanField(task.table, task.field, transaction);
        if (cleaned > 0) {
          console.log(`  ✅ Cleaned ${cleaned} record(s) in ${task.table}.${task.field}`);
          totalCleaned += cleaned;
        }
      } catch (error) {
        // Skip if table/column doesn't exist
        if (error.message.includes("does not exist") || error.message.includes("column")) {
          continue;
        }
        throw error;
      }
    }

    await transaction.commit();
    console.log(`\n✅ Cleanup completed! Total records cleaned: ${totalCleaned}\n`);
    return totalCleaned;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Verify cleanup
async function verifyCleanup() {
  console.log("\n🔍 Verifying cleanup...\n");

  const checks = [
    { table: "students", fields: ["email", "password", "fname", "lname"] },
    { table: "staff", fields: ["email", "password"] },
    { table: "wsp_admins", fields: ["email", "password"] },
  ];

  let allClean = true;

  for (const { table, fields } of checks) {
    for (const field of fields) {
      const count = await checkField(table, field);
      if (count > 0) {
        console.log(`  ⚠️  ${table}.${field}: ${count} record(s) still have single quotes`);
        allClean = false;
      }
    }
  }

  if (allClean) {
    console.log("  ✅ All checked fields are clean!\n");
  }

  return allClean;
}

// Main function
async function main() {
  console.log("=".repeat(60));
  console.log("  DATABASE CLEANUP: Remove Single Quotes (')");
  console.log("=".repeat(60));
  console.log("\n⚠️  IMPORTANT: This script will:");
  console.log("   ✅ Remove single quotes from all string fields");
  console.log("   ✅ Trim whitespace");
  console.log("   ✅ Lowercase email addresses");
  console.log("   ❌ Will NOT delete any tables, columns, or records");
  console.log("\n⚠️  Make sure you have a database backup!\n");

  try {
    // Connect to database
    console.log("🔌 Connecting to database...");
    await db.authenticate();
    console.log("✅ Database connection established\n");

    // Check what needs cleaning
    const { summary, totalRecords } = await checkDatabase();

    if (totalRecords === 0) {
      console.log("✅ No single quotes found in the database. Nothing to clean!\n");
      await db.close();
      rl.close();
      process.exit(0);
    }

    // Show summary
    console.log("📊 Summary of records with single quotes:\n");
    summary.forEach(({ table, fields, total }) => {
      console.log(`  ${table}: ${total} record(s)`);
      Object.entries(fields).forEach(([field, count]) => {
        console.log(`    - ${field}: ${count}`);
      });
    });
    console.log(`\n  Total: ${totalRecords} record(s) need cleaning\n`);

    // Ask for confirmation
    const confirm = await askQuestion("Do you want to proceed with cleanup? (yes/no): ");

    if (confirm !== "yes" && confirm !== "y") {
      console.log("\n❌ Cleanup cancelled by user\n");
      await db.close();
      rl.close();
      process.exit(0);
    }

    // Perform cleanup
    await cleanDatabase();

    // Verify cleanup
    await verifyCleanup();

    console.log("✅ Database cleanup completed successfully!\n");
    console.log("💡 Tip: Test login functionality to ensure everything works correctly.\n");

  } catch (error) {
    console.error("\n❌ Error during cleanup:", error.message);
    if (process.env.NODE_ENV === "development") {
      console.error("\n🔍 Full error:", error);
    }
    process.exit(1);
  } finally {
    await db.close();
    rl.close();
  }
}

// Run the script
main();

