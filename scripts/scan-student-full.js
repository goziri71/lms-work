/**
 * Full read-only snapshot: student, program, course regs, fees, orders, funding sample.
 * Usage: node scripts/scan-student-full.js WPU9301552
 */
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { Config } from "../src/config/config.js";

dotenv.config({ debug: false });

const matric = process.argv[2]?.trim();
if (!matric) {
  console.error("Usage: node scripts/scan-student-full.js <matric_number>");
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

  const [stuRows] = await db.query(
    `SELECT s.*, p.title AS program_title, p.id AS program_table_id, p.status AS program_status,
            f.name AS faculty_name
     FROM students s
     LEFT JOIN programs p ON p.id = s.program_id
     LEFT JOIN faculty f ON f.id = s.facaulty_id
     WHERE UPPER(TRIM(s.matric_number)) = UPPER(TRIM(:m))`,
    { replacements: { m: matric } }
  );

  if (!stuRows.length) {
    console.log(JSON.stringify({ error: "Student not found", matric }, null, 2));
    await db.close();
    return;
  }

  const stu = stuRows[0];
  const sid = stu.id;

  // Strip password from output
  const { password: _pw, ...studentSafe } = stu;

  const [regs] = await db.query(
    `SELECT cr.id AS reg_id, cr.course_id, cr.academic_year, cr.semester, cr.level AS reg_level,
            cr.registration_status, cr.date AS reg_date,
            cr.allocated_at, cr.registered_at, cr.course_reg_id AS order_link_id,
            c.course_code, c.title AS course_title, c.course_level AS catalog_course_level,
            c.program_id AS course_program_id, c.semester AS course_catalog_semester
     FROM course_reg cr
     JOIN courses c ON c.id = cr.course_id
     WHERE cr.student_id = :sid
     ORDER BY cr.academic_year NULLS LAST, cr.semester NULLS LAST, c.course_code`,
    { replacements: { sid } }
  );

  const [fees] = await db.query(
    `SELECT id, type, amount, currency, status, academic_year, semester, student_level, date, teller_no
     FROM school_fees WHERE student_id = :sid ORDER BY date DESC NULLS LAST, id DESC`,
    { replacements: { sid } }
  );

  const [orders] = await db.query(
    `SELECT id, amount, currency, date, semester, academic_year, level
     FROM course_order WHERE student_id = :sid ORDER BY date DESC NULLS LAST, id DESC LIMIT 25`,
    { replacements: { sid } }
  );

  const [funding] = await db.query(
    `SELECT id, type, amount, service_name, ref, date, semester, academic_year, currency, balance
     FROM funding WHERE student_id = :sid ORDER BY date DESC NULLS LAST, id DESC LIMIT 25`,
    { replacements: { sid } }
  );

  const regLevels = [...new Set(regs.map((r) => r.reg_level).filter(Boolean))];
  const catalogLevels = [...new Set(regs.map((r) => r.catalog_course_level).filter((x) => x != null))];

  const programMatchNote =
    studentSafe.program_title &&
    /PGD.*Information Technology|Information Technology.*PGD/i.test(studentSafe.program_title)
      ? "Program title matches PGD IT pattern (regex)"
      : `Program on file: "${studentSafe.program_title || "NULL"}" — compare manually to "PGD Information Technology"`;

  const today = new Date().toISOString().split("T")[0];
  const [calSem] = await db.query(
    `SELECT id, academic_year, semester, status, start_date, end_date
     FROM semester
     WHERE DATE(start_date) <= :d AND DATE(end_date) >= :d
     ORDER BY id DESC LIMIT 1`,
    { replacements: { d: today } }
  );

  console.log(
    JSON.stringify(
      {
        scanned_at_utc: new Date().toISOString(),
        calendar_semester_for_today: calSem[0] || null,
        student: studentSafe,
        program_check: {
          note: programMatchNote,
          expected_program_label: "PGD Information Technology",
        },
        registration_summary: {
          total_course_reg_rows: regs.length,
          distinct_reg_level: regLevels,
          distinct_catalog_course_level: catalogLevels,
          mismatches_reg_vs_catalog: regs
            .filter(
              (r) =>
                r.reg_level != null &&
                r.catalog_course_level != null &&
                String(r.reg_level).trim() !== String(r.catalog_course_level).trim()
            )
            .map((r) => ({
              reg_id: r.reg_id,
              course_code: r.course_code,
              reg_level: r.reg_level,
              catalog_course_level: r.catalog_course_level,
            })),
        },
        course_registrations: regs,
        school_fees: fees,
        course_orders_recent: orders,
        funding_recent: funding,
      },
      null,
      2
    )
  );

  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
