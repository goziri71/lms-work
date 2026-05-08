/**
 * Verify course_reg rows belong to a student, then set registration_status to allocated
 * so they can pay + register again via the student flow.
 *
 * Usage:
 *   node scripts/reset-course-regs-to-allocated.js WPU9301552 "2026/2027" 2ND
 *   node scripts/reset-course-regs-to-allocated.js WPU9301552 "2026/2027" 2ND --apply
 *   node scripts/reset-course-regs-to-allocated.js WPU9301552 "2026/2027" 2ND --ids=1278,1279,1280,1281,1282,1283,1284 --apply
 */
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { Config } from "../src/config/config.js";

dotenv.config({ debug: false });

const args = process.argv.slice(2).filter((a) => a !== "--apply");
const apply = process.argv.includes("--apply");
const idsArg = args.find((a) => a.startsWith("--ids="));
const idsFromCli = idsArg
  ? idsArg
      .replace("--ids=", "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n))
  : [];

const matric = args[0]?.trim();
const academicYear = args[1]?.trim();
const semester = args[2]?.trim();

if (!matric || !academicYear || !semester) {
  console.error(
    "Usage: node scripts/reset-course-regs-to-allocated.js <matric> <academic_year> <semester> [--ids=1,2,3] [--apply]"
  );
  process.exit(1);
}

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

async function main() {
  await db.authenticate();

  const [students] = await db.query(
    `SELECT id, matric_number, email, level, program_id
     FROM students
     WHERE matric_number = :m OR UPPER(TRIM(matric_number)) = UPPER(TRIM(:m))`,
    { replacements: { m: matric } }
  );

  if (!students.length) {
    console.log(JSON.stringify({ error: "Student not found", matric }, null, 2));
    await db.close();
    process.exit(1);
  }

  const student = students[0];
  const studentId = student.id;

  const safeIntIds = (arr) =>
    [...new Set(arr.map((x) => parseInt(x, 10)).filter((n) => Number.isInteger(n) && n > 0))];

  let regRows;
  if (idsFromCli.length) {
    const idList = safeIntIds(idsFromCli);
    if (idList.length === 0) {
      console.error("No valid numeric ids from --ids=");
      await db.close();
      process.exit(1);
    }
    const [rows] = await db.query(
      `SELECT cr.id, cr.student_id, cr.course_id, cr.academic_year, cr.semester,
              cr.registration_status, cr.course_reg_id, cr.registered_at,
              c.course_code, c.title
       FROM course_reg cr
       LEFT JOIN courses c ON c.id = cr.course_id
       WHERE cr.id IN (${idList.join(",")})`
    );
    regRows = rows;
  } else {
    const [rows] = await db.query(
      `SELECT cr.id, cr.student_id, cr.course_id, cr.academic_year, cr.semester,
              cr.registration_status, cr.course_reg_id, cr.registered_at,
              c.course_code, c.title
       FROM course_reg cr
       LEFT JOIN courses c ON c.id = cr.course_id
       WHERE cr.student_id = :sid
         AND cr.academic_year = :ay
         AND cr.semester = :sem
         AND cr.registration_status = 'registered'`,
      { replacements: { sid: studentId, ay: academicYear, sem: semester } }
    );
    regRows = rows;
  }

  const ayNorm = String(academicYear);
  const semNorm = String(semester).toUpperCase();

  const wrongStudent = regRows.filter((r) => r.student_id !== studentId);
  const wrongTerm = regRows.filter(
    (r) =>
      String(r.academic_year) !== ayNorm ||
      String(r.semester || "").toUpperCase() !== semNorm
  );

  const report = {
    student: {
      id: student.id,
      matric_number: student.matric_number,
      email: student.email,
    },
    academic_year: academicYear,
    semester,
    apply,
    rows_found: regRows.length,
    ids_requested: idsFromCli.length || "(all registered for term)",
    ownership_ok: wrongStudent.length === 0,
    term_ok: wrongTerm.length === 0,
    rows: regRows,
  };

  if (wrongStudent.length) {
    report.error = "These course_reg ids do NOT belong to this student — abort.";
    report.wrong_student_rows = wrongStudent;
    console.log(JSON.stringify(report, null, 2));
    await db.close();
    process.exit(1);
  }

  if (wrongTerm.length) {
    report.error = "Row academic_year/semester does not match — abort.";
    report.wrong_term_rows = wrongTerm;
    console.log(JSON.stringify(report, null, 2));
    await db.close();
    process.exit(1);
  }

  if (regRows.length === 0) {
    report.note = "No rows to update.";
    console.log(JSON.stringify(report, null, 2));
    await db.close();
    return;
  }

  if (!apply) {
    report.note =
      "Dry run only. Re-run with --apply to set status=allocated and clear course_reg_id, registered_at.";
    console.log(JSON.stringify(report, null, 2));
    await db.close();
    return;
  }

  const ids = safeIntIds(regRows.map((r) => r.id));
  await db.query(
    `UPDATE course_reg
     SET registration_status = 'allocated',
         course_reg_id = NULL,
         registered_at = NULL
     WHERE id IN (${ids.join(",")})
       AND student_id = ${parseInt(studentId, 10)}`
  );

  const [after] = await db.query(
    `SELECT id, course_id, registration_status, course_reg_id, registered_at
     FROM course_reg WHERE id IN (${ids.join(",")}) ORDER BY id`
  );

  report.updated = after;
  console.log(JSON.stringify(report, null, 2));
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
