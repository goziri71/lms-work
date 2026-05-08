/**
 * One-off: PGD IT (program 56) final-semester bundle was catalogued as 600; align to 700.
 * Re-syncs course_reg.level from courses for student 321 (WPU9301552).
 *
 * Run: node scripts/apply-pgd-wpu9301552-level-fix.js
 */
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { Config } from "../src/config/config.js";

dotenv.config({ debug: false });

const PGD_PROGRAM_ID = 56;
const STUDENT_ID = 321;

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

  const [, meta1] = await db.query(
    `UPDATE courses
     SET course_level = 700
     WHERE program_id = :pid
       AND course_level = 600
       AND id IN (638, 639, 637, 640, 641, 643, 748)`,
    { replacements: { pid: PGD_PROGRAM_ID } }
  );

  const [, meta2] = await db.query(
    `UPDATE course_reg AS cr
     SET level = LEFT(CAST(c.course_level AS VARCHAR(10)), 5)
     FROM courses c
     WHERE cr.course_id = c.id AND cr.student_id = :sid`,
    { replacements: { sid: STUDENT_ID } }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        courses_rows_updated: meta1?.rowCount ?? null,
        course_reg_rows_updated: meta2?.rowCount ?? null,
        student_id: STUDENT_ID,
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
