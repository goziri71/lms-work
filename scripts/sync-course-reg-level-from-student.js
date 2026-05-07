/**
 * Set course_reg.level to match students.level for semester-based rows.
 * Skips marketplace rows (no academic_year/semester).
 *
 * Usage:
 *   node scripts/sync-course-reg-level-from-student.js WPU9301552
 *   node scripts/sync-course-reg-level-from-student.js 321
 */
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { Config } from "../src/config/config.js";

dotenv.config({ debug: false });

const arg = process.argv[2]?.trim();
if (!arg) {
  console.error(
    "Usage: node scripts/sync-course-reg-level-from-student.js <matric_number|student_id>"
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

  const isNumericId = /^\d+$/.test(arg);
  const [students] = await db.query(
    isNumericId
      ? `SELECT id, matric_number, email, level FROM students WHERE id = :id`
      : `SELECT id, matric_number, email, level FROM students
         WHERE matric_number = :m OR UPPER(TRIM(matric_number)) = UPPER(TRIM(:m))`,
    isNumericId ? { replacements: { id: parseInt(arg, 10) } } : { replacements: { m: arg } }
  );

  if (!students.length) {
    console.error(JSON.stringify({ error: "Student not found", lookup: arg }, null, 2));
    await db.close();
    process.exit(1);
  }

  const s = students[0];
  const targetLevel =
    s.level != null && String(s.level).trim() !== "" ? String(s.level).trim() : null;

  if (!targetLevel) {
    console.error(
      JSON.stringify(
        {
          error: "students.level is empty; set profile level first",
          student: { id: s.id, matric_number: s.matric_number },
        },
        null,
        2
      )
    );
    await db.close();
    process.exit(1);
  }

  const [, meta] = await db.query(
    `UPDATE course_reg
     SET level = :lvl
     WHERE student_id = :sid
       AND academic_year IS NOT NULL
       AND semester IS NOT NULL
       AND registration_status IN ('allocated', 'registered')`,
    {
      replacements: {
        lvl: targetLevel.substring(0, 5),
        sid: s.id,
      },
    }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        student: {
          id: s.id,
          matric_number: s.matric_number,
          students_level: s.level,
        },
        course_reg_level_set_to: targetLevel.substring(0, 5),
        rows_updated: meta?.rowCount ?? null,
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
