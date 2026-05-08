/**
 * Route PGD IT (program 56) official 2ND-semester bundle + Project to a student.
 * Canonical: CSC703, CSC722, CSC736, CSC742, CSC752, CSC799.
 *
 *   node scripts/route-pgd-it-second-sem.js WPU9301552 "2026/2027" 2ND
 *   node scripts/route-pgd-it-second-sem.js WPU9301552 "2026/2027" 2ND --apply
 */
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { Config } from "../src/config/config.js";

dotenv.config({ debug: false });

const PGD_IT_PROGRAM_ID = 56;
const TARGET_CODES = ["CSC703", "CSC722", "CSC736", "CSC742", "CSC752", "CSC799"];

const args = process.argv.slice(2).filter((a) => a !== "--apply");
const apply = process.argv.includes("--apply");

const matric = args[0]?.trim();
const academicYear = args[1]?.trim();
const semester = args[2]?.trim()?.toUpperCase();

if (!matric || !academicYear || !semester) {
  console.error(
    "Usage: node scripts/route-pgd-it-second-sem.js <matric> <academic_year> <1ST|2ND> [--apply]"
  );
  process.exit(1);
}

const db = new Sequelize(
  Config.database.url || Config.database.name,
  Config.database.username,
  Config.database.password,
  {
    host: Config.database.host,
    dialect: "postgres",
    logging: false,
    dialectOptions: Config.database.dialectOptions,
    pool: Config.database.pool,
  }
);

async function getPrice(dbConn, courseId, ay, sem) {
  const [pr] = await dbConn.query(
    `SELECT price FROM course_semester_pricing
     WHERE course_id = :cid AND academic_year = :ay AND semester = :sem
     LIMIT 1`,
    { replacements: { cid: courseId, ay, sem } }
  );
  if (pr.length && pr[0].price != null) return parseFloat(pr[0].price) || 0;
  const [cr] = await dbConn.query(`SELECT price FROM courses WHERE id = :cid`, {
    replacements: { cid: courseId },
  });
  if (cr.length && cr[0].price != null) return parseFloat(cr[0].price) || 0;
  return 0;
}

async function main() {
  await db.authenticate();

  const [stuRows] = await db.query(
    `SELECT id, matric_number, program_id, facaulty_id, level, currency
     FROM students
     WHERE matric_number = :m OR UPPER(TRIM(matric_number)) = UPPER(TRIM(:m))`,
    { replacements: { m: matric } }
  );
  if (!stuRows.length) {
    console.error(JSON.stringify({ error: "Student not found", matric }));
    await db.close();
    process.exit(1);
  }
  const student = stuRows[0];
  const sid = student.id;

  if (Number(student.program_id) !== PGD_IT_PROGRAM_ID) {
    console.error(
      JSON.stringify({
        error: "Student is not PGD Information Technology (program 56)",
        program_id: student.program_id,
      })
    );
    await db.close();
    process.exit(1);
  }

  const [courseRows] = await db.query(
    `SELECT id, course_code, title, course_level
     FROM courses
     WHERE program_id = :pid
       AND semester = :sem
       AND UPPER(TRIM(course_code)) IN (${TARGET_CODES.map((_, i) => `:c${i}`).join(",")})
       AND owner_type IN ('wpu', 'wsp')
       AND COALESCE(is_marketplace, false) = false`,
    {
      replacements: {
        pid: PGD_IT_PROGRAM_ID,
        sem: semester,
        ...Object.fromEntries(TARGET_CODES.map((c, i) => [`c${i}`, c])),
      },
    }
  );

  if (courseRows.length !== TARGET_CODES.length) {
    const found = courseRows.map((r) => r.course_code?.trim().toUpperCase());
    const missing = TARGET_CODES.filter((c) => !found.includes(c.toUpperCase()));
    console.error(
      JSON.stringify({
        error: "Catalog mismatch: expected 6 PGD 2ND courses",
        found: courseRows,
        missing_codes: missing,
      })
    );
    await db.close();
    process.exit(1);
  }

  const targetIds = courseRows.map((r) => r.id);
  const [existing] = await db.query(
    `SELECT cr.id, cr.student_id, cr.course_id, c.course_code, cr.registration_status
     FROM course_reg cr
     JOIN courses c ON c.id = cr.course_id
     WHERE cr.student_id = ${sid}
       AND cr.academic_year = :ay
       AND cr.semester = :sem
     ORDER BY c.course_code`,
    { replacements: { ay: academicYear, sem: semester } }
  );

  const report = {
    student: { id: sid, matric_number: student.matric_number, program_id: student.program_id },
    term: { academic_year: academicYear, semester },
    target_courses: courseRows,
    existing_rows_for_term: existing,
    apply,
  };

  const extras = existing.filter((r) => !targetIds.includes(r.course_id));
  const targetsExisting = existing.filter((r) => targetIds.includes(r.course_id));

  report.extras_to_cancel = extras;
  report.targets_status = targetsExisting;

  if (!apply) {
    report.note = "Dry run. Pass --apply to cancel extras, re-allocate targets, insert missing.";
    console.log(JSON.stringify(report, null, 2));
    await db.close();
    return;
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const level = String(student.level ?? "700");

  if (extras.length) {
    const extraIds = extras.map((e) => e.id).join(",");
    await db.query(
      `UPDATE course_reg
       SET registration_status = 'cancelled'
       WHERE id IN (${extraIds})
         AND student_id = ${sid}`
    );
  }

  for (const row of courseRows) {
    const price = await getPrice(db, row.id, academicYear, semester);
    const [one] = await db.query(
      `SELECT id, registration_status FROM course_reg
       WHERE student_id = :sid AND course_id = :cid AND academic_year = :ay AND semester = :sem`,
      { replacements: { sid, cid: row.id, ay: academicYear, sem: semester } }
    );

    if (one.length) {
      const reg = one[0];
      if (reg.registration_status !== "registered") {
        await db.query(
          `UPDATE course_reg SET
            registration_status = 'allocated',
            program_id = :pid,
            facaulty_id = :fid,
            level = :lev,
            allocated_price = :price,
            allocated_at = :now,
            course_reg_id = NULL,
            registered_at = NULL
           WHERE id = :rid AND student_id = :sid`,
          {
            replacements: {
              rid: reg.id,
              sid,
              pid: student.program_id,
              fid: student.facaulty_id,
              lev: level,
              price,
              now,
            },
          }
        );
      }
    } else {
      await db.query(
        `INSERT INTO course_reg (
          student_id, course_id, academic_year, semester, program_id, facaulty_id, level,
          registration_status, allocated_price, allocated_at,
          first_ca, second_ca, third_ca, exam_score, date
        ) VALUES (
          :sid, :cid, :ay, :sem, :pid, :fid, :lev,
          'allocated', :price, :now,
          0, 0, 0, 0, :today
        )`,
        {
          replacements: {
            sid,
            cid: row.id,
            ay: academicYear,
            sem: semester,
            pid: student.program_id,
            fid: student.facaulty_id,
            lev: level,
            price,
            now,
            today,
          },
        }
      );
    }
  }

  const [after] = await db.query(
    `SELECT cr.id, c.course_code, cr.registration_status, cr.allocated_price
     FROM course_reg cr
     JOIN courses c ON c.id = cr.course_id
     WHERE cr.student_id = ${sid}
       AND cr.academic_year = :ay
       AND cr.semester = :sem
       AND cr.registration_status IN ('allocated', 'registered')
     ORDER BY c.course_code`,
    { replacements: { ay: academicYear, sem: semester } }
  );

  report.after_apply_active = after;
  console.log(JSON.stringify(report, null, 2));
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
