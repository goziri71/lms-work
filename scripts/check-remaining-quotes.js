import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { Config } from "../src/config/config.js";

dotenv.config({ debug: false });

// Database connection
const db = new Sequelize(
  Config.database.url || Config.database.name,
  Config.database.username,
  Config.database.password,
  {
    host: Config.database.host,
    dialect: Config.database.dialect,
    logging: false,
    dialectOptions: Config.database.dialectOptions,
    pool: Config.database.pool,
  }
);

// All string fields in students table
const studentFields = [
  "email", "password", "fname", "lname", "mname", "phone", "matric_number",
  "address", "application_code", "referral_code", "token", "state_origin",
  "country", "lcda", "gender", "dob", "file", "admin_status", "g_status",
  "level", "a_status", "study_mode", "teller_no", "account_no", "account_name",
  "bank", "currency", "certificate_file", "birth_certificate", "ref_letter",
  "valid_id", "resume_cv", "other_file", "school1_date", "school2", "school2_date",
  "application_fee"
];

async function checkRemainingQuotes() {
  try {
    console.log("🔍 Checking for remaining single quotes in students table...\n");
    
    await db.authenticate();
    console.log("✅ Database connection established\n");

    const results = [];

    for (const field of studentFields) {
      try {
        const [rows] = await db.query(`
          SELECT COUNT(*) as count
          FROM students
          WHERE ${field} IS NOT NULL 
            AND ${field} LIKE '%''%'
        `);
        
        const count = parseInt(rows[0].count);
        if (count > 0) {
          results.push({ field, count });
        }
      } catch (error) {
        // Column might not exist, skip it
        if (error.message.includes("does not exist") || error.message.includes("column")) {
          continue;
        }
      }
    }

    if (results.length === 0) {
      console.log("✅ No single quotes found in students table!\n");
    } else {
      console.log("⚠️  Found single quotes in the following columns:\n");
      results.forEach(({ field, count }) => {
        console.log(`  ${field}: ${count} record(s)`);
      });
      console.log(`\n  Total: ${results.reduce((sum, r) => sum + r.count, 0)} record(s) need cleaning\n`);
    }

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkRemainingQuotes();

