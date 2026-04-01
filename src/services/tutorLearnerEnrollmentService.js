/**
 * Shared logic: which students count as a tutor's marketplace learners
 * (aligned with GET /tutor/learners listing).
 */

import { Op } from "sequelize";
import { Students } from "../models/auth/student.js";
import { Courses } from "../models/course/courses.js";
import { CourseReg } from "../models/course_reg.js";
import { MarketplaceTransaction } from "../models/marketplace/marketplaceTransaction.js";

export async function getMarketplaceCourseIdsForTutor(tutorId, tutorType) {
  const rows = await Courses.findAll({
    where: {
      owner_id: tutorId,
      owner_type: tutorType,
      is_marketplace: true,
    },
    attributes: ["id"],
  });
  return rows.map((r) => r.id);
}

export async function isStudentEnrolledWithTutor(tutorId, tutorType, studentId) {
  const courseIds = await getMarketplaceCourseIdsForTutor(tutorId, tutorType);
  if (courseIds.length === 0) return false;

  const sid = parseInt(studentId, 10);
  if (Number.isNaN(sid) || sid <= 0) return false;

  const enrolled = await CourseReg.findOne({
    where: {
      student_id: sid,
      course_id: { [Op.in]: courseIds },
      registration_status: "marketplace_purchased",
    },
  });
  if (enrolled) return true;

  const tx = await MarketplaceTransaction.findOne({
    where: {
      student_id: sid,
      course_id: { [Op.in]: courseIds },
      owner_id: tutorId,
      owner_type: tutorType,
      payment_status: "completed",
    },
  });
  return !!tx;
}

/**
 * @returns {Promise<import("sequelize").Model|null>} Student row or null if not enrolled
 */
export async function getStudentIfEnrolledWithTutor(tutorId, tutorType, studentId) {
  const ok = await isStudentEnrolledWithTutor(tutorId, tutorType, studentId);
  if (!ok) return null;

  return Students.findByPk(parseInt(studentId, 10), {
    attributes: ["id", "fname", "mname", "lname", "email"],
  });
}
