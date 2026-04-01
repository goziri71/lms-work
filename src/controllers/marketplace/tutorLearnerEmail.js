/**
 * Tutors email enrolled learners (ZeptoMail) — To + CC + BCC
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { emailService } from "../../services/emailService.js";
import { getStudentIfEnrolledWithTutor } from "../../services/tutorLearnerEnrollmentService.js";
import { getTutorInfo } from "./tutorLearnerManagement.js";
import { EmailLog } from "../../models/email/emailLog.js";

const MAX_SUBJECT = 200;
const MAX_BODY = 50_000;
const MAX_CC = 20;
const MAX_BCC = 20;

function tutorDisplayName(req) {
  const t = req.tutor;
  const ut = req.user?.userType;
  if (ut === "sole_tutor") {
    const n = `${t.fname || ""} ${t.lname || ""}`.trim();
    return n || t.business_name || t.email;
  }
  if (ut === "organization") {
    return t.name || t.email;
  }
  if (ut === "organization_user") {
    const n = `${t.fname || ""} ${t.lname || ""}`.trim();
    return n || t.email;
  }
  return t.email || "Instructor";
}

function tutorReplyEmail(req) {
  const t = req.tutor;
  const ut = req.user?.userType;
  if (ut === "sole_tutor") return t.email;
  if (ut === "organization") return t.contact_email || t.email;
  if (ut === "organization_user") return t.email;
  return t.email;
}

function normalizeEmailList(raw, max) {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    if (out.length >= max) break;
    const s = String(item ?? "").trim();
    if (!s) continue;
    const lower = s.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(s);
  }
  return out;
}

/**
 * POST /api/marketplace/tutor/learners/email
 * Body: { student_id, subject, body, cc?: string[], bcc?: string[] }
 */
export const sendEmailToLearner = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { student_id, subject, body, cc, bcc } = req.body;

  if (student_id == null || student_id === "") {
    throw new ErrorClass("student_id is required", 400);
  }
  if (!subject || String(subject).trim().length === 0) {
    throw new ErrorClass("subject is required", 400);
  }
  if (subject.length > MAX_SUBJECT) {
    throw new ErrorClass(`subject must be at most ${MAX_SUBJECT} characters`, 400);
  }
  if (body == null || String(body).trim().length === 0) {
    throw new ErrorClass("body is required", 400);
  }
  if (String(body).length > MAX_BODY) {
    throw new ErrorClass(`body must be at most ${MAX_BODY} characters`, 400);
  }

  let ccList = normalizeEmailList(cc, MAX_CC);
  let bccList = normalizeEmailList(bcc, MAX_BCC);

  for (const e of [...ccList, ...bccList]) {
    if (!emailService.validateEmail(e)) {
      throw new ErrorClass(`Invalid email address in cc/bcc: ${e}`, 400);
    }
  }

  const student = await getStudentIfEnrolledWithTutor(tutorId, tutorType, student_id);
  if (!student) {
    throw new ErrorClass(
      "Learner not found or is not enrolled in any of your marketplace courses",
      404
    );
  }

  const primaryEmail = String(student.email || "").trim();
  if (!primaryEmail || !emailService.validateEmail(primaryEmail)) {
    throw new ErrorClass("Learner has no valid email on file", 400);
  }

  const primaryLower = primaryEmail.toLowerCase();
  ccList = ccList.filter((e) => e.toLowerCase() !== primaryLower);
  bccList = bccList.filter(
    (e) => e.toLowerCase() !== primaryLower && !ccList.some((c) => c.toLowerCase() === e.toLowerCase())
  );

  const learnerName =
    `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim() || primaryEmail;

  const replyAddr = tutorReplyEmail(req);
  const replyTo =
    replyAddr && emailService.validateEmail(replyAddr)
      ? { address: replyAddr, name: tutorDisplayName(req) }
      : null;

  const result = await emailService.sendTutorLearnerMessage({
    to: primaryEmail,
    toName: learnerName,
    subject: String(subject).trim(),
    messageText: String(body),
    tutorName: tutorDisplayName(req),
    cc: ccList,
    bcc: bccList,
    replyTo,
  });

  try {
    await EmailLog.create({
      user_id: student.id,
      user_type: "student",
      recipient_email: primaryEmail,
      recipient_name: learnerName,
      email_type: "announcement",
      subject: String(subject).trim(),
      status: result.success ? "sent" : "failed",
      sent_at: result.success ? new Date() : null,
      error_message: result.success ? null : result.message,
      metadata: {
        channel: "tutor_to_learner",
        tutor_id: tutorId,
        tutor_type: tutorType,
        cc: ccList,
        bcc: bccList,
      },
    });
  } catch (logErr) {
    console.error("EmailLog create failed (tutor learner email):", logErr);
  }

  if (!result.success) {
    throw new ErrorClass(result.message || "Failed to send email", 502);
  }

  res.status(200).json({
    success: true,
    message: "Email sent successfully",
    data: {
      to: primaryEmail,
      cc: ccList,
      bcc: bccList,
    },
  });
});
