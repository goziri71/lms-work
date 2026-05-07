import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { Config } from "../src/config/config.js";
import { checkSchoolFeesPayment } from "../src/services/paymentVerificationService.js";

dotenv.config({ debug: false });

const matric = process.argv[2] || "WPU9301552";

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
  const today = new Date().toISOString().split("T")[0];

  const [studentRows] = await db.query(
    "SELECT id, matric_number FROM students WHERE UPPER(TRIM(matric_number)) = UPPER(TRIM(:m))",
    { replacements: { m: matric } }
  );
  const student = studentRows[0];
  if (!student) {
    console.log(JSON.stringify({ error: "student not found", matric }, null, 2));
    await db.close();
    return;
  }
  const sid = student.id;

  const [fees] = await db.query(
    `SELECT id, academic_year, semester, status, type, date,
            length(trim(academic_year)) AS ay_len, length(trim(semester)) AS sem_len
     FROM school_fees WHERE student_id = :sid ORDER BY id`,
    { replacements: { sid } }
  );

  const [sems] = await db.query(
    `SELECT id, academic_year, semester, status, start_date, end_date
     FROM semester
     ORDER BY id DESC
     LIMIT 12`
  );

  const [inRange] = await db.query(
    `SELECT id, academic_year, semester, status, start_date, end_date
     FROM semester
     WHERE DATE(start_date) <= :d AND DATE(end_date) >= :d
     ORDER BY id DESC`,
    { replacements: { d: today } }
  );

  const cal = inRange[0];
  const check1 = cal
    ? await checkSchoolFeesPayment(sid, String(cal.academic_year), String(cal.semester))
    : false;

  const checkPaid2nd = await checkSchoolFeesPayment(sid, "2026/2027", "2ND");

  console.log(
    JSON.stringify(
      {
        today,
        student,
        school_fees_rows: fees,
        semesters_recent: sems,
        semester_calendar_match_today: inRange,
        checkSchoolFeesPayment_for_calendar_semester: check1,
        calendar_ay: cal?.academic_year,
        calendar_sem: cal?.semester,
        checkSchoolFeesPayment_explicit_2026_2027_2ND: checkPaid2nd,
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
