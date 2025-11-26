import { db } from "../database/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../database/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration script to import courses from MySQL SQL dump to PostgreSQL
 * 
 * Usage: node src/scripts/migrateCoursesFromSQL.js [path-to-courses.sql]
 */

// Extract INSERT statements from SQL file
function extractInsertStatements(sqlContent) {
  const inserts = [];
  const lines = sqlContent.split("\n");
  let currentInsert = "";
  let inInsert = false;

  for (let line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.toUpperCase().startsWith("INSERT INTO")) {
      if (currentInsert) {
        inserts.push(currentInsert);
      }
      currentInsert = trimmed;
      inInsert = true;
    } else if (inInsert) {
      currentInsert += " " + trimmed;
      // Check if INSERT statement is complete
      if (trimmed.endsWith(";") || trimmed.match(/\);?\s*$/)) {
        inserts.push(currentInsert.replace(/;+$/, "").trim());
        currentInsert = "";
        inInsert = false;
      }
    }
  }
  
  if (currentInsert) {
    inserts.push(currentInsert.replace(/;+$/, "").trim());
  }

  return inserts;
}

// Parse a single INSERT statement and extract all rows
function parseInsertStatement(insertStmt) {
  // Extract table name and columns
  const tableMatch = insertStmt.match(/INSERT INTO\s+`?(\w+)`?\s*\(([^)]+)\)/i);
  if (!tableMatch) return null;

  const tableName = tableMatch[1];
  const columnsStr = tableMatch[2];
  const columns = columnsStr
    .split(",")
    .map((col) => col.trim().replace(/`/g, ""));

  // Extract VALUES part
  const valuesMatch = insertStmt.match(/VALUES\s+(.+)$/i);
  if (!valuesMatch) return null;

  const valuesStr = valuesMatch[1];
  
  // Parse all value tuples
  const rows = [];
  let currentRow = "";
  let depth = 0;
  let inString = false;
  let stringChar = null;

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    const prevChar = i > 0 ? valuesStr[i - 1] : null;

    if (!inString && char === "(") {
      if (depth === 0) {
        currentRow = "";
      }
      depth++;
      if (depth > 1) currentRow += char;
    } else if (!inString && char === ")") {
      depth--;
      if (depth === 0) {
        // Complete row
        const values = parseRowValues(currentRow, columns.length);
        rows.push({ columns, values });
        currentRow = "";
        // Skip comma and whitespace after closing paren
        while (i + 1 < valuesStr.length && (valuesStr[i + 1] === "," || valuesStr[i + 1] === " ")) {
          i++;
        }
      } else {
        currentRow += char;
      }
    } else if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      currentRow += char;
    } else if (inString && char === stringChar && prevChar !== "\\") {
      inString = false;
      stringChar = null;
      currentRow += char;
    } else {
      currentRow += char;
    }
  }

  return { tableName, columns, rows };
}

// Parse values from a single row string
function parseRowValues(rowStr, expectedCount) {
  const values = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = null;

  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    const prevChar = i > 0 ? rowStr[i - 1] : null;

    if (!inQuotes && char === ",") {
      values.push(current.trim());
      current = "";
    } else if (!inQuotes && (char === "'" || char === '"')) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar && prevChar !== "\\") {
      inQuotes = false;
      quoteChar = null;
      current += char;
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    values.push(current.trim());
  }

  return values;
}

// Convert MySQL value to PostgreSQL-compatible value
function convertValue(value, columnName) {
  const trimmed = value.trim();

  // Handle NULL
  if (trimmed === "NULL" || trimmed === "null" || trimmed === "") {
    return null;
  }

  // Handle invalid MySQL dates
  if (
    columnName === "date" &&
    (trimmed === "'0000-00-00 00:00:00'" ||
      trimmed === "0000-00-00 00:00:00" ||
      trimmed === "'0000-00-00'" ||
      trimmed === "0000-00-00")
  ) {
    return null;
  }

  // Handle quoted strings
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    let unquoted = trimmed.slice(1, -1);
    // Unescape MySQL escapes
    unquoted = unquoted.replace(/\\'/g, "'");
    unquoted = unquoted.replace(/\\"/g, '"');
    unquoted = unquoted.replace(/\\\\/g, "\\");
    unquoted = unquoted.replace(/\\n/g, "\n");
    unquoted = unquoted.replace(/\\r/g, "\r");
    unquoted = unquoted.replace(/\\t/g, "\t");
    return unquoted;
  }

  // Return as-is for numbers
  return trimmed;
}

// Convert parsed rows to course objects
function rowsToCourses(parsed) {
  const courses = [];
  const columnMap = {};

  // Create column index map
  parsed.columns.forEach((col, idx) => {
    columnMap[col] = idx;
  });

  for (const row of parsed.rows) {
    const course = {};

    // Map each column
    Object.keys(columnMap).forEach((colName) => {
      const idx = columnMap[colName];
      if (idx < row.values.length) {
        const rawValue = row.values[idx];
        const converted = convertValue(rawValue, colName);

        // Type conversion
        if (
          colName === "id" ||
          colName === "faculty_id" ||
          colName === "program_id" ||
          colName === "course_unit" ||
          colName === "course_level" ||
          colName === "user_id" ||
          colName === "exam_fee" ||
          colName === "staff_id"
        ) {
          course[colName] = converted !== null && converted !== "" ? parseInt(converted, 10) : null;
        } else if (colName === "date") {
          if (converted) {
            try {
              course[colName] = new Date(converted);
            } catch (e) {
              course[colName] = new Date(); // Default to current date
            }
          } else {
            course[colName] = new Date(); // Default to current date (required field)
          }
        } else {
          course[colName] = converted;
        }
      }
    });

    courses.push(course);
  }

  return courses;
}

// Insert courses in batches
async function insertCourses(courses, batchSize = 50) {
  let totalInserted = 0;
  let totalErrors = 0;

  console.log(`\n💾 Inserting ${courses.length} courses in batches of ${batchSize}...`);

  for (let i = 0; i < courses.length; i += batchSize) {
    const batch = courses.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(courses.length / batchSize);

    try {
      // Build batch insert
      const placeholders = [];
      const values = [];
      let paramIndex = 1;

      for (const course of batch) {
        const rowValues = [
          course.id,
          course.faculty_id || null,
          course.program_id || null,
          course.title || null,
          course.course_unit || null,
          course.price || null,
          course.course_type || null,
          course.course_level || null,
          course.semester || null,
          course.user_id || null,
          course.course_code || null,
          course.token || null,
          course.exam_fee || null,
          course.currency || null,
          course.staff_id !== undefined && course.staff_id !== null ? course.staff_id : 0, // Required field
          course.date || new Date(), // Required field
          "wpu", // owner_type (default)
          null, // owner_id
          false, // is_marketplace (default)
          null, // marketplace_status
        ];

        placeholders.push(`(${rowValues.map(() => `$${paramIndex++}`).join(", ")})`);
        values.push(...rowValues);
      }

      const sql = `
        INSERT INTO courses (
          id, faculty_id, program_id, title, course_unit, price, course_type,
          course_level, semester, user_id, course_code, token, exam_fee, currency,
          staff_id, date, owner_type, owner_id, is_marketplace, marketplace_status
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT (id) DO NOTHING
      `;

      await db.query(sql, { bind: values });
      totalInserted += batch.length;
      console.log(`   ✅ Batch ${batchNum}/${totalBatches}: ${batch.length} courses inserted`);
    } catch (error) {
      totalErrors += batch.length;
      console.error(`   ❌ Batch ${batchNum}/${totalBatches} failed:`, error.message);
      
      // Try inserting individually to identify problematic records
      console.log(`   🔍 Attempting individual inserts for batch ${batchNum}...`);
      for (const course of batch) {
        try {
          await insertSingleCourse(course);
          totalInserted++;
          totalErrors--;
        } catch (singleError) {
          console.error(`      ❌ Failed course ID ${course.id}: ${singleError.message}`);
        }
      }
    }
  }

  return { inserted: totalInserted, errors: totalErrors };
}

// Insert a single course
async function insertSingleCourse(course) {
  const sql = `
    INSERT INTO courses (
      id, faculty_id, program_id, title, course_unit, price, course_type,
      course_level, semester, user_id, course_code, token, exam_fee, currency,
      staff_id, date, owner_type, owner_id, is_marketplace, marketplace_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    ON CONFLICT (id) DO NOTHING
  `;

  const values = [
    course.id,
    course.faculty_id || null,
    course.program_id || null,
    course.title || null,
    course.course_unit || null,
    course.price || null,
    course.course_type || null,
    course.course_level || null,
    course.semester || null,
    course.user_id || null,
    course.course_code || null,
    course.token || null,
    course.exam_fee || null,
    course.currency || null,
    course.staff_id !== undefined && course.staff_id !== null ? course.staff_id : 0,
    course.date || new Date(),
    "wpu", // owner_type (default)
    null,
    false,
    null,
  ];

  await db.query(sql, { bind: values });
}

// Main migration function
async function migrateCourses(sqlFilePath) {
  try {
    console.log("🚀 Starting course migration from MySQL to PostgreSQL");
    console.log(`📂 Reading SQL file: ${sqlFilePath}\n`);

    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL file not found: ${sqlFilePath}`);
    }

    // Read SQL file
    const sqlContent = fs.readFileSync(sqlFilePath, "utf8");
    console.log(`📄 File size: ${(sqlContent.length / 1024).toFixed(2)} KB`);

    // Extract INSERT statements
    console.log("🔍 Extracting INSERT statements...");
    const insertStatements = extractInsertStatements(sqlContent);
    console.log(`   Found ${insertStatements.length} INSERT statement(s)\n`);

    // Parse all INSERT statements
    console.log("📊 Parsing course data...");
    const allCourses = [];

    for (let i = 0; i < insertStatements.length; i++) {
      const parsed = parseInsertStatement(insertStatements[i]);
      if (!parsed) {
        console.warn(`   ⚠️  Could not parse INSERT statement ${i + 1}`);
        continue;
      }

      const courses = rowsToCourses(parsed);
      allCourses.push(...courses);
      console.log(`   ✅ Parsed ${courses.length} courses from INSERT ${i + 1}`);
    }

    console.log(`\n📦 Total courses parsed: ${allCourses.length}`);

    // Check current database state
    const [currentCount] = await db.query("SELECT COUNT(*) as count FROM courses");
    console.log(`📊 Current courses in database: ${currentCount[0].count}\n`);

    // Insert courses
    const result = await insertCourses(allCourses, 50);

    // Final summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ Migration Summary");
    console.log("=".repeat(60));
    console.log(`   📦 Total courses processed: ${allCourses.length}`);
    console.log(`   ✅ Successfully inserted (new courses only): ${result.inserted}`);
    console.log(`   ❌ Errors: ${result.errors}`);

    // Final count
    const [finalCount] = await db.query("SELECT COUNT(*) as count FROM courses");
    console.log(`\n📊 Final courses in database: ${finalCount[0].count}`);
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}

// Main execution
const sqlFilePath = process.argv[2] || path.join(__dirname, "../../../Downloads/courses.sql");

// Try alternative paths if default doesn't exist
let actualPath = sqlFilePath;
if (!fs.existsSync(actualPath)) {
  const userHome = process.env.USERPROFILE || process.env.HOME;
  actualPath = path.join(userHome, "Downloads", "courses.sql");
}

if (!fs.existsSync(actualPath)) {
  console.error(`❌ SQL file not found`);
  console.error(`   Tried: ${sqlFilePath}`);
  console.error(`   Tried: ${actualPath}`);
  console.error("\n💡 Usage: node src/scripts/migrateCoursesFromSQL.js <path-to-courses.sql>");
  process.exit(1);
}

// Run migration
connectDB()
  .then(async (success) => {
    if (!success) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    try {
      await migrateCourses(actualPath);
      await db.close();
      console.log("\n🔒 Database connection closed");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ Migration failed:", error);
      await db.close();
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  });
