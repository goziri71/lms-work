import { authService } from "../service/authservice.js";
import { Students } from "../models/auth/student.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";

export function normalizeCreatorEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

async function passwordMatches(plainPassword, account) {
  if (!account?.password) return false;
  return authService.comparePassword(plainPassword, account.password);
}

/**
 * After a verified student login, link learner + creator when the same password
 * works for both (proves same person). Returns optional creator JWT for the FE.
 */
export async function linkStudentToCreatorOnLogin(student, plainPassword) {
  if (!student?.id || !student.email || !plainPassword) {
    return { linked: false, creatorAccessToken: null, hasCreatorAccount: false };
  }

  const email = normalizeCreatorEmail(student.email);
  let creatorAccessToken = null;
  let hasCreatorAccount = false;
  let linked = false;

  const soleTutor = await SoleTutor.findOne({ where: { email } });
  if (soleTutor && soleTutor.status === "active") {
    hasCreatorAccount = true;
    const samePassword = await passwordMatches(plainPassword, soleTutor);
    if (samePassword) {
      if (soleTutor.linked_student_id !== student.id) {
        await soleTutor.update({ linked_student_id: student.id });
      }
      linked = true;
      creatorAccessToken = await authService.generateAccessToken({
        id: soleTutor.id,
        userType: "sole_tutor",
        email: soleTutor.email,
        firstName: soleTutor.fname,
        lastName: soleTutor.lname,
        status: soleTutor.status,
      });
      return {
        linked: true,
        creatorAccessToken,
        hasCreatorAccount: true,
        creatorUserType: "sole_tutor",
      };
    }
  }

  const organization = await Organization.findOne({ where: { email } });
  if (organization && organization.status === "active") {
    hasCreatorAccount = true;
    const samePassword = await passwordMatches(plainPassword, organization);
    if (samePassword) {
      if (organization.linked_student_id !== student.id) {
        await organization.update({ linked_student_id: student.id });
      }
      linked = true;
      creatorAccessToken = await authService.generateAccessToken({
        id: organization.id,
        userType: "organization",
        email: organization.email,
        name: organization.name,
        status: organization.status,
      });
      return {
        linked: true,
        creatorAccessToken,
        hasCreatorAccount: true,
        creatorUserType: "organization",
      };
    }
  }

  return { linked, creatorAccessToken, hasCreatorAccount };
}

/** When creator logs in, link if learner account exists with same password. */
export async function linkCreatorToStudentOnLogin(creatorRecord, plainPassword, kind) {
  if (!creatorRecord?.email || !plainPassword) return;

  const email = normalizeCreatorEmail(creatorRecord.email);
  const student = await Students.findOne({ where: { email } });
  if (!student) return;

  const samePassword = await passwordMatches(plainPassword, student);
  if (!samePassword) return;

  if (creatorRecord.linked_student_id === student.id) return;

  await creatorRecord.update({ linked_student_id: student.id });
}

/**
 * Resolve active creator account previously linked to this student (for tutorAuthorize).
 */
export async function resolveLinkedCreatorForStudentId(studentId) {
  if (!studentId) return null;

  const soleTutor = await SoleTutor.findOne({
    where: { linked_student_id: studentId, status: "active" },
  });
  if (soleTutor) {
    return { userType: "sole_tutor", tutor: soleTutor, id: soleTutor.id };
  }

  const organization = await Organization.findOne({
    where: { linked_student_id: studentId, status: "active" },
  });
  if (organization) {
    return { userType: "organization", tutor: organization, id: organization.id };
  }

  return null;
}

export async function studentHasUnlinkedCreatorAccount(email) {
  const normalized = normalizeCreatorEmail(email);
  const [soleTutor, organization] = await Promise.all([
    SoleTutor.findOne({
      where: { email: normalized, status: "active" },
      attributes: ["id", "linked_student_id"],
    }),
    Organization.findOne({
      where: { email: normalized, status: "active" },
      attributes: ["id", "linked_student_id"],
    }),
  ]);
  if (soleTutor && !soleTutor.linked_student_id) return true;
  if (organization && !organization.linked_student_id) return true;
  return false;
}
