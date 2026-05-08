/**
 * Cancel duplicate auto-allocations when the student already completed
 * registration for the same term (legacy migration + lazy re-allocation).
 *
 * Default: student 321, 2026/2027 2ND, PGD canonical five 700-level course IDs.
 *
 * Run: node scripts/cancel-duplicate-pgd-700-allocations.js
 */
import dotenv from "dotenv";
import { Op } from "sequelize";
import { db } from "../src/database/database.js";
import { CourseReg } from "../src/models/course_reg.js";

dotenv.config({ debug: false });

const STUDENT_ID = parseInt(process.env.STUDENT_ID || "321", 10);
const ACADEMIC_YEAR = process.env.ACADEMIC_YEAR || "2026/2027";
const SEMESTER = process.env.SEMESTER || "2ND";
/** CSC722, CSC736, CSC742, CSC752, CSC703 */
const CANONICAL_700_COURSE_IDS = [743, 744, 745, 746, 747];

async function main() {
  const registered = await CourseReg.count({
    where: {
      student_id: STUDENT_ID,
      academic_year: ACADEMIC_YEAR,
      semester: SEMESTER,
      registration_status: "registered",
    },
  });

  if (registered === 0) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          reason:
            "No registered rows for this term; not cancelling allocations.",
        },
        null,
        2,
      ),
    );
    await db.close();
    return;
  }

  const [n] = await CourseReg.update(
    { registration_status: "cancelled" },
    {
      where: {
        student_id: STUDENT_ID,
        academic_year: ACADEMIC_YEAR,
        semester: SEMESTER,
        registration_status: "allocated",
        course_id: { [Op.in]: CANONICAL_700_COURSE_IDS },
      },
    },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        student_id: STUDENT_ID,
        rows_cancelled: n,
        registered_count_for_term: registered,
      },
      null,
      2,
    ),
  );

  await db.close();
}

main().catch((e) => {
  console.error(e);
  db.close();
  process.exit(1);
});
