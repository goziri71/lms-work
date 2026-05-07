/**
 * One-off / CLI: inspect level fields for a student by matric.
 * Usage: node scripts/inspect-student-levels.js WPU9301552
 */
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { Config } from "../src/config/config.js";

dotenv.config({ debug: false });

const matric = process.argv[2]?.trim();
if (!matric) {
  console.error("Usage: node scripts/inspect-student-levels.js <matric_number>");
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
    `SELECT id, matric_number, email, level FROM students
     WHERE matric_number = :m OR UPPER(TRIM(matric_number)) = UPPER(TRIM(:m))`,
    { replacements: { m: matric } }
  );

  if (!students.length) {
    console.log(JSON.stringify({ error: "Student not found", matric }, null, 2));
    await db.close();
    return;
  }

  const s = students[0];
  const sid = s.id;

  const [regs] = await db.query(
    `SELECT id, course_id, academic_year, semester, level, registration_status, date
     FROM course_reg WHERE student_id = :sid
     ORDER BY academic_year NULLS LAST, semester NULLS LAST, id`,
    { replacements: { sid } }
  );

  const [fees] = await db.query(
    `SELECT id, type, academic_year, semester, student_level, status, date, teller_no
     FROM school_fees WHERE student_id = :sid
     ORDER BY date DESC NULLS LAST, id DESC`,
    { replacements: { sid } }
  );

  const summarize = (label, values) => {
    const uniq = [...new Set(values.filter(Boolean).map(String))];
    return { label, distinct_values: uniq };
  };

  const regLevels = regs.map((r) => r.level);
  const feeLevels = fees.map((f) => f.student_level);

  console.log(
    JSON.stringify(
      {
        student_profile: {
          id: s.id,
          matric_number: s.matric_number,
          email: s.email,
          students_level: s.level,
        },
        distinct_course_reg_levels: summarize("course_reg.level", regLevels),
        distinct_school_fees_student_level: summarize(
          "school_fees.student_level",
          feeLevels
        ),
        course_reg_rows: regs,
        school_fees_rows: fees,
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
