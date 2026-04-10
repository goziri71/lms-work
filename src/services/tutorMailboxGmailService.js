/**
 * Tutor connected Gmail: OAuth (PKCE), send, sync, MIME helpers.
 */

import { google } from "googleapis";
import jwt from "jsonwebtoken";
import { ErrorClass } from "../utils/errorClass/index.js";
import { TutorMailbox } from "../models/marketplace/tutorMailbox.js";
import { MailThread } from "../models/marketplace/mailThread.js";
import { MailMessage } from "../models/marketplace/mailMessage.js";
import { storeEncryptedTokens, getDecryptedTokens } from "./tutorMailboxTokenHelper.js";
import { resolvePublicApiBase } from "../utils/publicApiUrl.js";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

export function getGoogleMailboxOAuthConfig() {
  const clientId =
    process.env.GOOGLE_MAILBOX_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    null;
  const clientSecret =
    process.env.GOOGLE_MAILBOX_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    null;
  const redirectUri =
    process.env.GOOGLE_MAILBOX_REDIRECT_URI?.trim() ||
    `${resolvePublicApiBase()}/api/marketplace/tutor/mailbox/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

function getOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getGoogleMailboxOAuthConfig();
  if (!clientId || !clientSecret) {
    throw new ErrorClass(
      "Gmail mailbox OAuth not configured. Set GOOGLE_MAILBOX_CLIENT_ID and GOOGLE_MAILBOX_CLIENT_SECRET (or shared Google OAuth vars).",
      500
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function normalizeAuthCode(code) {
  if (code == null) return "";
  let c = String(code).trim();
  if (c.includes("%")) {
    try {
      c = decodeURIComponent(c);
    } catch {
      /* ignore */
    }
  }
  return c;
}

export function createMailboxGmailState({ tutorId, tutorType, codeVerifier }) {
  const secret = process.env.JWT_SECRET || "your-secret";
  const payload = {
    purpose: "tutor_mailbox_gmail",
    tutorId,
    tutorType,
  };
  if (codeVerifier) payload.cv = codeVerifier;
  return jwt.sign(payload, secret, { expiresIn: "15m", algorithm: "HS256" });
}

export function verifyMailboxGmailState(state) {
  if (!state || typeof state !== "string") {
    throw new ErrorClass("OAuth state is required", 400);
  }
  const secret = process.env.JWT_SECRET || "your-secret";
  try {
    const decoded = jwt.verify(state, secret);
    if (decoded.purpose !== "tutor_mailbox_gmail") throw new Error("bad purpose");
    if (decoded.tutorId == null || !decoded.tutorType) throw new Error("bad payload");
    return {
      tutorId: decoded.tutorId,
      tutorType: decoded.tutorType,
      codeVerifier: decoded.cv || null,
    };
  } catch {
    throw new ErrorClass(
      "Invalid or expired OAuth state. Start Connect Gmail again from the app.",
      400
    );
  }
}

export async function buildGmailMailboxAuthorizationUrl({ tutorId, tutorType }) {
  const oauth2Client = getOAuth2Client();
  const { codeVerifier, codeChallenge } = await oauth2Client.generateCodeVerifierAsync();
  const state = createMailboxGmailState({ tutorId, tutorType, codeVerifier });
  const params = {
    access_type: "offline",
    scope: GMAIL_SCOPES,
    state,
    prompt: "consent",
    include_granted_scopes: true,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  };
  const authUrl = oauth2Client.generateAuthUrl(params);
  return { authUrl, state };
}

export async function exchangeGmailMailboxCode(code, codeVerifier) {
  const oauth2Client = getOAuth2Client();
  const { redirectUri } = getGoogleMailboxOAuthConfig();
  const normalized = normalizeAuthCode(code);
  if (!normalized) throw new ErrorClass("Authorization code missing", 400);

  const opts = {
    code: normalized,
    redirect_uri: redirectUri,
  };
  if (codeVerifier) opts.codeVerifier = codeVerifier;

  try {
    const { tokens } = await oauth2Client.getToken(opts);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();
    return {
      tokens,
      email: profile.email,
    };
  } catch (error) {
    const data = error?.response?.data;
    const errCode = data?.error;
    console.error("Gmail mailbox token exchange:", errCode || error?.message);
    if (errCode === "invalid_grant") {
      throw new ErrorClass(
        "Google could not accept this authorization code. Start Connect again and complete in one step.",
        400
      );
    }
    throw new ErrorClass("Failed to connect Gmail mailbox", 500);
  }
}

async function ensureAccessToken(mailbox) {
  const { access_token, refresh_token } = getDecryptedTokens(mailbox);
  if (!access_token) throw new ErrorClass("Mailbox token missing", 401);

  const bufferMs = 120 * 1000;
  const expired =
    !mailbox.token_expires_at ||
    new Date(mailbox.token_expires_at).getTime() < Date.now() + bufferMs;

  if (!expired) {
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials({ access_token, refresh_token });
    return { oauth2, access_token };
  }

  if (!refresh_token) {
    throw new ErrorClass("Gmail session expired; reconnect your mailbox.", 401);
  }

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token });
  const { credentials } = await oauth2.refreshAccessToken();
  await storeEncryptedTokens(mailbox, {
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token || refresh_token,
    expires_in: credentials.expiry_date
      ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
      : 3600,
    scope: mailbox.scope,
  });
  await mailbox.reload();
  const at = getDecryptedTokens(mailbox).access_token;
  oauth2.setCredentials({ access_token: at, refresh_token: getDecryptedTokens(mailbox).refresh_token });
  return { oauth2, access_token: at };
}

export async function getGmailApi(mailbox) {
  const { oauth2 } = await ensureAccessToken(mailbox);
  return google.gmail({ version: "v1", auth: oauth2 });
}

function headerMap(headers) {
  const m = {};
  if (!headers) return m;
  for (const h of headers) {
    m[String(h.name).toLowerCase()] = h.value || "";
  }
  return m;
}

function decodeB64(data) {
  if (!data) return "";
  const s = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(s, "base64").toString("utf8");
}

function extractBodies(part, out) {
  if (!part) return;
  if (part.body?.data) {
    const mime = (part.mimeType || "").toLowerCase();
    if (mime.includes("text/plain")) out.text = decodeB64(part.body.data);
    if (mime.includes("text/html")) out.html = decodeB64(part.body.data);
  }
  if (part.parts) {
    for (const p of part.parts) extractBodies(p, out);
  }
}

export function parseGmailMessageResource(msg) {
  const id = msg.id;
  const threadId = msg.threadId;
  const internalDate = msg.internalDate ? BigInt(msg.internalDate) : null;
  const headers = headerMap(msg.payload?.headers);
  const from = headers["from"] || "";
  const to = headers["to"] || "";
  const cc = headers["cc"] || "";
  const bcc = headers["bcc"] || "";
  const subject = headers["subject"] || "";
  const mid = headers["message-id"] || "";
  const inReplyTo = headers["in-reply-to"] || "";
  const references = headers["references"] || "";

  const out = { text: "", html: "" };
  extractBodies(msg.payload, out);

  return {
    provider_message_id: id,
    external_thread_id: threadId,
    from_email: from,
    to_email: to,
    cc,
    bcc,
    subject,
    body_text: out.text || null,
    body_html: out.html || null,
    rfc_message_id: mid || null,
    in_reply_to: inReplyTo || null,
    references_header: references || null,
    internal_date_ms: internalDate,
    labelIds: msg.labelIds || [],
  };
}

function buildRawMime({ fromEmail, to, cc, bcc, subject, bodyText, inReplyTo, references }) {
  const lines = [];
  lines.push(`From: ${fromEmail}`);
  lines.push(`To: ${to}`);
  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  lines.push(`Subject: ${subject.replace(/\r?\n/g, " ")}`);
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push("Content-Transfer-Encoding: base64");
  lines.push("");
  const b64 = Buffer.from(bodyText || "", "utf8").toString("base64");
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(b64.slice(i, i + 76));
  }
  const raw = lines.join("\r\n");
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Send email from tutor mailbox; optionally attach to existing Gmail thread.
 */
export async function sendGmailFromMailbox(mailbox, opts) {
  const {
    to,
    cc = "",
    bcc = "",
    subject,
    bodyText,
    threadId: gmailThreadId,
    inReplyTo,
    references,
  } = opts;

  const gmail = await getGmailApi(mailbox);
  const fromEmail = mailbox.email_address;
  const raw = buildRawMime({
    fromEmail,
    to,
    cc,
    bcc,
    subject,
    bodyText,
    inReplyTo,
    references,
  });

  const body = { raw };
  if (gmailThreadId) body.threadId = gmailThreadId;

  const sent = await gmail.users.messages.send({
    userId: "me",
    requestBody: body,
  });

  const full = await gmail.users.messages.get({
    userId: "me",
    id: sent.data.id,
    format: "full",
  });

  return parseGmailMessageResource(full.data);
}

/**
 * Sync new messages via history API when possible, else list recent.
 */
export async function syncGmailMailbox(mailbox) {
  const gmail = await getGmailApi(mailbox);
  const profile = await gmail.users.getProfile({ userId: "me" });
  const currentHistoryId = profile.data.historyId;

  const upsertParsed = async (parsed, direction) => {
    const extId = parsed.external_thread_id || `orphan-${parsed.provider_message_id}`;
    const [thread] = await MailThread.findOrCreate({
      where: {
        tutor_mailbox_id: mailbox.id,
        external_thread_id: extId,
      },
      defaults: {
        tutor_mailbox_id: mailbox.id,
        tutor_id: mailbox.tutor_id,
        tutor_type: mailbox.tutor_type,
        subject: parsed.subject,
        last_message_at: parsed.internal_date_ms
          ? new Date(Number(parsed.internal_date_ms))
          : new Date(),
        snippet: (parsed.body_text || "").slice(0, 500),
        unread_count: 0,
      },
    });

    const t = new Date(Number(parsed.internal_date_ms || Date.now()));
    if (!thread.last_message_at || t > thread.last_message_at) {
      await thread.update({
        last_message_at: t,
        subject: parsed.subject || thread.subject,
        snippet: (parsed.body_text || "").slice(0, 500),
      });
    }

    const [, msgCreated] = await MailMessage.findOrCreate({
      where: {
        tutor_mailbox_id: mailbox.id,
        provider_message_id: parsed.provider_message_id,
      },
      defaults: {
        thread_id: thread.id,
        direction,
        from_email: parsed.from_email,
        to_email: parsed.to_email,
        cc: parsed.cc || null,
        bcc: parsed.bcc || null,
        subject: parsed.subject,
        body_text: parsed.body_text,
        body_html: parsed.body_html,
        rfc_message_id: parsed.rfc_message_id,
        in_reply_to: parsed.in_reply_to,
        references_header: parsed.references_header,
        internal_date_ms: parsed.internal_date_ms ? Number(parsed.internal_date_ms) : null,
        is_read: direction === "sent" || !parsed.labelIds?.includes("UNREAD"),
        sent_or_received_at: parsed.internal_date_ms
          ? new Date(Number(parsed.internal_date_ms))
          : new Date(),
        metadata: { labelIds: parsed.labelIds },
      },
    });

    if (!msgCreated) return;
  };

  try {
    if (mailbox.provider_sync_cursor) {
      const hist = await gmail.users.history.list({
        userId: "me",
        startHistoryId: mailbox.provider_sync_cursor,
        historyTypes: ["messageAdded"],
      });
      const history = hist.data.history || [];
      for (const h of history) {
        const added = h.messagesAdded || [];
        for (const { message } of added) {
          if (!message?.id) continue;
          const full = await gmail.users.messages.get({
            userId: "me",
            id: message.id,
            format: "full",
          });
          const parsed = parseGmailMessageResource(full.data);
          const fromAddr = (parsed.from_email || "").toLowerCase();
          const me = (mailbox.email_address || "").toLowerCase();
          const direction = fromAddr.includes(me) ? "sent" : "received";
          await upsertParsed(parsed, direction);
        }
      }
    } else {
      const list = await gmail.users.messages.list({
        userId: "me",
        maxResults: 40,
        q: "in:inbox OR in:sent",
      });
      const ids = list.data.messages || [];
      for (const m of ids) {
        const full = await gmail.users.messages.get({
          userId: "me",
          id: m.id,
          format: "full",
        });
        const parsed = parseGmailMessageResource(full.data);
        const fromAddr = (parsed.from_email || "").toLowerCase();
        const me = (mailbox.email_address || "").toLowerCase();
        const direction = fromAddr.includes(me) ? "sent" : "received";
        await upsertParsed(parsed, direction);
      }
    }
  } catch (e) {
    console.warn("Gmail history sync fallback:", e.message);
    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: 40,
      q: "newer_than:7d",
    });
    const ids = list.data.messages || [];
    for (const m of ids) {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: m.id,
        format: "full",
      });
      const parsed = parseGmailMessageResource(full.data);
      const fromAddr = (parsed.from_email || "").toLowerCase();
      const me = (mailbox.email_address || "").toLowerCase();
      const direction = fromAddr.includes(me) ? "sent" : "received";
      await upsertParsed(parsed, direction);
    }
  }

  await mailbox.update({
    provider_sync_cursor: currentHistoryId,
    last_sync_at: new Date(),
  });
}
