/**
 * Read-only scan: find students whose stored level disagrees with related rows.
 * Uses the same Postgres connection as the app (Config + .env).
 *
 * Run: npm run scan:level-inconsistencies
 * Or:  node scripts/scan-student-level-inconsistencies.js
 */
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { Config } from "../src/config/config.js";

dotenv.config({ debug: false });

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

const isNumericLevel = `trim(coalesce(level, '')) ~ '^[0-9]+$'`;

async function main() {
  try {
    await db.authenticate();
  } catch (e) {
    console.error("Database connection failed. Check .env (DATABASE_URL or DB_*).", e.message);
    process.exit(1);
  }

  const sections = [];

  // 1) Students with missing or non-numeric level
  const [invalidStudentLevel] = await db.query(`
    SELECT id, matric_number, email, level
    FROM students
    WHERE level IS NULL
       OR trim(level) = ''
       OR trim(level) !~ '^[0-9]+$'
    ORDER BY id
  `);
  sections.push({
    title: "A) Students — level NULL, empty, or not purely numeric",
    rows: invalidStudentLevel,
  });

  // 2) Normal course registrations: course_reg.level != students.level (both numeric)
  const [courseRegMismatch] = await db.query(`
    SELECT
      cr.student_id,
      s.matric_number,
      s.email,
      s.level AS student_level,
      cr.level AS course_reg_level,
      cr.academic_year,
      cr.semester,
      cr.registration_status,
      cr.id AS course_reg_id
    FROM course_reg cr
    JOIN students s ON s.id = cr.student_id
    WHERE cr.academic_year IS NOT NULL
      AND cr.semester IS NOT NULL
      AND cr.registration_status IN ('allocated', 'registered')
      AND ${isNumericLevel.replace(/level/g, "s.level")}
      AND ${isNumericLevel.replace(/level/g, "cr.level")}
      AND trim(s.level)::int <> trim(cr.level)::int
    ORDER BY cr.student_id, cr.academic_year, cr.semester, cr.id
  `);
  sections.push({
    title:
      "B) course_reg vs students — academic rows (allocated/registered), both numeric, values differ",
    rows: courseRegMismatch,
  });

  // 3) Same student + AY + semester but more than one distinct course_reg.level
  const [multiLevelPerTerm] = await db.query(`
    SELECT
      student_id,
      academic_year,
      semester,
      array_agg(DISTINCT trim(coalesce(level, '')) ORDER BY trim(coalesce(level, ''))) AS distinct_levels,
      count(*)::int AS row_count
    FROM course_reg
    WHERE academic_year IS NOT NULL
      AND semester IS NOT NULL
    GROUP BY student_id, academic_year, semester
    HAVING count(DISTINCT trim(coalesce(level, ''))) > 1
    ORDER BY student_id, academic_year, semester
  `);
  sections.push({
    title: "C) course_reg — multiple distinct level values for same student + AY + semester",
    rows: multiLevelPerTerm,
  });

  // 4) Paid school fees snapshot vs current student level (often expected after progression)
  const [feeSnapshotMismatch] = await db.query(`
    SELECT
      sf.id AS school_fee_id,
      sf.student_id,
      s.matric_number,
      sf.academic_year,
      sf.semester,
      sf.student_level AS fee_snapshot_level,
      s.level AS current_student_level
    FROM school_fees sf
    JOIN students s ON s.id = sf.student_id
    WHERE sf.status = 'Paid'
      AND ${isNumericLevel.replace(/level/g, "s.level")}
      AND ${isNumericLevel.replace(/level/g, "sf.student_level")}
      AND trim(s.level)::int <> trim(sf.student_level)::int
    ORDER BY sf.student_id, sf.academic_year, sf.semester, sf.id
  `);
  sections.push({
    title:
      "D) school_fees (Paid) — student_level snapshot vs current students.level (review; may be historical)",
    rows: feeSnapshotMismatch,
  });

  // Summary: unique student ids affected by B (the main “UI mismatch” signal)
  const affectedFromB = [...new Set(courseRegMismatch.map((r) => r.student_id))].sort(
    (a, b) => a - b
  );

  console.log(JSON.stringify({ summary: { studentsWithCourseRegLevelMismatch: affectedFromB.length, studentIds: affectedFromB }, sections }, null, 2));

  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
