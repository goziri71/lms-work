/**
 * Tutor connected mailboxes (Gmail / Outlook): OAuth, send, threads, sync.
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { getTutorInfo } from "./tutorLearnerManagement.js";
import { TutorMailbox } from "../../models/marketplace/tutorMailbox.js";
import { MailThread } from "../../models/marketplace/mailThread.js";
import { MailMessage } from "../../models/marketplace/mailMessage.js";
import { storeEncryptedTokens } from "../../services/tutorMailboxTokenHelper.js";
import {
  buildGmailMailboxAuthorizationUrl,
  verifyMailboxGmailState,
  exchangeGmailMailboxCode,
  sendGmailFromMailbox,
  syncGmailMailbox,
} from "../../services/tutorMailboxGmailService.js";
import {
  buildOutlookAuthUrl,
  verifyOutlookState,
  exchangeOutlookCode,
  getOutlookProfileEmail,
  sendOutlookMail,
  syncOutlookMailbox,
} from "../../services/tutorMailboxOutlookService.js";
import { getStudentIfEnrolledWithTutor } from "../../services/tutorLearnerEnrollmentService.js";

export const getMailboxConnectGmail = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { authUrl, state } = await buildGmailMailboxAuthorizationUrl({ tutorId, tutorType });
  res.json({
    success: true,
    data: { authorization_url: authUrl, state },
  });
});

export const getMailboxConnectOutlook = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { authUrl, state } = buildOutlookAuthUrl({ tutorId, tutorType });
  res.json({
    success: true,
    data: { authorization_url: authUrl, state },
  });
});

export const handleGmailMailboxCallback = TryCatchFunction(async (req, res) => {
  const { code, state } = req.query;
  if (!code) throw new ErrorClass("Missing code", 400);
  const { tutorId, tutorType, codeVerifier } = verifyMailboxGmailState(state);
  const { tokens, email } = await exchangeGmailMailboxCode(code, codeVerifier);

  const [mailbox] = await TutorMailbox.findOrCreate({
    where: { tutor_id: tutorId, tutor_type: tutorType, provider: "gmail" },
    defaults: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      provider: "gmail",
      email_address: email || "unknown@unknown",
      access_token: "",
      is_active: true,
      connected_at: new Date(),
    },
  });

  await storeEncryptedTokens(mailbox, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in:
      tokens.expiry_date != null
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
        : tokens.expires_in || 3600,
    scope: tokens.scope,
  });
  await mailbox.update({
    email_address: email || mailbox.email_address,
    is_active: true,
  });
  await mailbox.reload();

  try {
    await syncGmailMailbox(mailbox);
  } catch (e) {
    console.warn("Initial Gmail sync:", e.message);
  }

  res.json({
    success: true,
    message: "Gmail connected",
    data: { email: mailbox.email_address, provider: "gmail" },
  });
});

export const handleOutlookMailboxCallback = TryCatchFunction(async (req, res) => {
  const { code, state } = req.query;
  if (!code) throw new ErrorClass("Missing code", 400);
  const { tutorId, tutorType } = verifyOutlookState(state);
  const tokens = await exchangeOutlookCode(code);

  const [mailbox] = await TutorMailbox.findOrCreate({
    where: { tutor_id: tutorId, tutor_type: tutorType, provider: "outlook" },
    defaults: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      provider: "outlook",
      email_address: "pending@local",
      access_token: "",
      is_active: true,
      connected_at: new Date(),
    },
  });

  await storeEncryptedTokens(mailbox, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    scope: tokens.scope,
  });
  await mailbox.reload();

  const email = await getOutlookProfileEmail(mailbox);
  await mailbox.update({ email_address: email || mailbox.email_address });

  try {
    await syncOutlookMailbox(mailbox);
  } catch (e) {
    console.warn("Initial Outlook sync:", e.message);
  }

  res.json({
    success: true,
    message: "Outlook connected",
    data: { email: mailbox.email_address, provider: "outlook" },
  });
});

export const listMailboxes = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const rows = await TutorMailbox.findAll({
    where: { tutor_id: tutorId, tutor_type: tutorType, is_active: true },
    attributes: [
      "id",
      "provider",
      "email_address",
      "last_sync_at",
      "connected_at",
    ],
  });
  res.json({ success: true, data: { mailboxes: rows } });
});

export const disconnectMailbox = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;
  const m = await TutorMailbox.findOne({
    where: { id, tutor_id: tutorId, tutor_type: tutorType },
  });
  if (!m) throw new ErrorClass("Mailbox not found", 404);
  await m.update({ is_active: false });
  res.json({ success: true, message: "Disconnected" });
});

async function loadMailbox(tutorId, tutorType, mailboxId) {
  const m = await TutorMailbox.findOne({
    where: {
      id: mailboxId,
      tutor_id: tutorId,
      tutor_type: tutorType,
      is_active: true,
    },
  });
  if (!m) throw new ErrorClass("Mailbox not found", 404);
  return m;
}

export const sendMailboxEmail = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const {
    mailbox_id,
    to,
    subject,
    body,
    cc,
    bcc,
    thread_id,
    student_id,
  } = req.body;

  if (!mailbox_id || !to || !subject || body == null) {
    throw new ErrorClass("mailbox_id, to, subject, and body are required", 400);
  }

  const mailboxIdNum = parseInt(mailbox_id, 10);
  if (Number.isNaN(mailboxIdNum) || mailboxIdNum <= 0) {
    throw new ErrorClass("mailbox_id must be a positive integer", 400);
  }

  const mailbox = await loadMailbox(tutorId, tutorType, mailboxIdNum);

  let learnerStudentId = null;
  if (student_id != null) {
    const st = await getStudentIfEnrolledWithTutor(tutorId, tutorType, student_id);
    if (!st) {
      throw new ErrorClass("Student is not one of your enrolled learners", 404);
    }
    learnerStudentId = st.id;
  }

  const ccStr = Array.isArray(cc) ? cc.join(", ") : cc || "";
  const bccStr = Array.isArray(bcc) ? bcc.join(", ") : bcc || "";

  let inReplyTo = null;
  let references = null;
  let gmailThreadId = null;

  if (thread_id) {
    const thr = await MailThread.findOne({
      where: { id: thread_id, tutor_id: tutorId, tutor_type: tutorType },
    });
    if (!thr) throw new ErrorClass("Thread not found", 404);
    if (thr.tutor_mailbox_id !== mailbox.id) {
      throw new ErrorClass("Thread does not belong to this mailbox", 400);
    }
    gmailThreadId = thr.external_thread_id;
    const last = await MailMessage.findOne({
      where: { thread_id: thr.id },
      order: [["sent_or_received_at", "DESC"]],
    });
    if (last?.rfc_message_id) {
      inReplyTo = last.rfc_message_id.trim();
      references = last.references_header
        ? `${last.references_header} ${inReplyTo}`.trim()
        : inReplyTo;
    }
  }

  if (mailbox.provider === "gmail") {
    const parsed = await sendGmailFromMailbox(mailbox, {
      to,
      cc: ccStr,
      bcc: bccStr,
      subject,
      bodyText: String(body),
      threadId: gmailThreadId,
      inReplyTo,
      references,
    });

    const extId = parsed.external_thread_id || `orphan-${parsed.provider_message_id}`;
    const [thread] = await MailThread.findOrCreate({
      where: { tutor_mailbox_id: mailbox.id, external_thread_id: extId },
      defaults: {
        tutor_mailbox_id: mailbox.id,
        tutor_id: tutorId,
        tutor_type: tutorType,
        subject,
        learner_student_id: learnerStudentId,
        last_message_at: new Date(Number(parsed.internal_date_ms || Date.now())),
        snippet: String(body).slice(0, 500),
      },
    });
    if (learnerStudentId && !thread.learner_student_id) {
      await thread.update({ learner_student_id: learnerStudentId });
    }

    await MailMessage.create({
      thread_id: thread.id,
      tutor_mailbox_id: mailbox.id,
      direction: "sent",
      from_email: mailbox.email_address,
      to_email: to,
      cc: ccStr || null,
      bcc: bccStr || null,
      subject,
      body_text: String(body),
      provider_message_id: parsed.provider_message_id,
      rfc_message_id: parsed.rfc_message_id,
      in_reply_to: inReplyTo,
      references_header: references,
      internal_date_ms: parsed.internal_date_ms ? Number(parsed.internal_date_ms) : null,
      is_read: true,
      sent_or_received_at: new Date(Number(parsed.internal_date_ms || Date.now())),
      metadata: { via: "gmail_api" },
    });

    await thread.update({
      last_message_at: new Date(),
      subject: subject || thread.subject,
    });

    return res.json({
      success: true,
      data: { thread_id: thread.id, provider_message_id: parsed.provider_message_id },
    });
  }

  if (mailbox.provider === "outlook") {
    const result = await sendOutlookMail(mailbox, {
      to,
      cc: ccStr,
      bcc: bccStr,
      subject,
      bodyText: String(body),
      threadId: thread_id,
    });
    if (result?.threadId && learnerStudentId) {
      await MailThread.update(
        { learner_student_id: learnerStudentId },
        { where: { id: result.threadId } }
      );
    }
    return res.json({ success: true, data: result });
  }

  throw new ErrorClass("Unsupported provider", 400);
});

export const listThreads = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { mailbox_id, page = 1, limit = 20 } = req.query;
  const where = { tutor_id: tutorId, tutor_type: tutorType };
  if (mailbox_id) where.tutor_mailbox_id = mailbox_id;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await MailThread.findAndCountAll({
    where,
    order: [["last_message_at", "DESC NULLS LAST"]],
    limit: parseInt(limit, 10),
    offset,
  });

  res.json({
    success: true,
    data: {
      threads: rows,
      pagination: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / parseInt(limit, 10)),
      },
    },
  });
});

export const getThreadDetail = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const thread = await MailThread.findOne({
    where: { id: req.params.id, tutor_id: tutorId, tutor_type: tutorType },
  });
  if (!thread) throw new ErrorClass("Thread not found", 404);
  res.json({ success: true, data: { thread } });
});

export const listThreadMessages = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const thread = await MailThread.findOne({
    where: { id: req.params.id, tutor_id: tutorId, tutor_type: tutorType },
  });
  if (!thread) throw new ErrorClass("Thread not found", 404);

  const messages = await MailMessage.findAll({
    where: { thread_id: thread.id },
    order: [["sent_or_received_at", "ASC"]],
  });
  res.json({ success: true, data: { messages } });
});

export const syncMailbox = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { mailbox_id } = req.body;
  if (!mailbox_id) throw new ErrorClass("mailbox_id required", 400);
  const mailbox = await loadMailbox(tutorId, tutorType, mailbox_id);

  if (mailbox.provider === "gmail") {
    await syncGmailMailbox(mailbox);
  } else if (mailbox.provider === "outlook") {
    await syncOutlookMailbox(mailbox);
  } else {
    throw new ErrorClass("Unknown provider", 400);
  }

  res.json({ success: true, message: "Sync completed" });
});
