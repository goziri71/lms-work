/**
 * Microsoft Graph mailbox for tutors (Outlook / Microsoft 365 personal or work).
 */

import axios from "axios";
import jwt from "jsonwebtoken";
import { ErrorClass } from "../utils/errorClass/index.js";
import { MailThread } from "../models/marketplace/mailThread.js";
import { MailMessage } from "../models/marketplace/mailMessage.js";
import { storeEncryptedTokens, getDecryptedTokens } from "./tutorMailboxTokenHelper.js";
import { resolvePublicApiBase } from "../utils/publicApiUrl.js";

const MS_AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0";
const MS_GRAPH = "https://graph.microsoft.com/v1.0";

const OUTLOOK_SCOPES = [
  "offline_access",
  "openid",
  "profile",
  "email",
  "User.Read",
  "Mail.Read",
  "Mail.Send",
].join(" ");

function getOutlookConfig() {
  const clientId = process.env.MICROSOFT_MAILBOX_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || null;
  const clientSecret =
    process.env.MICROSOFT_MAILBOX_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || null;
  const redirectUri =
    process.env.MICROSOFT_MAILBOX_REDIRECT_URI?.trim() ||
    `${resolvePublicApiBase()}/api/marketplace/tutor/mailbox/microsoft/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function buildOutlookAuthUrl({ tutorId, tutorType }) {
  const { clientId, redirectUri } = getOutlookConfig();
  if (!clientId) {
    throw new ErrorClass("Microsoft mailbox OAuth not configured (MICROSOFT_MAILBOX_CLIENT_ID).", 500);
  }
  const secret = process.env.JWT_SECRET || "your-secret";
  const state = jwt.sign(
    { purpose: "tutor_mailbox_outlook", tutorId, tutorType },
    secret,
    { expiresIn: "15m", algorithm: "HS256" }
  );
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: OUTLOOK_SCOPES,
    state,
  });
  return { authUrl: `${MS_AUTH}/authorize?${params.toString()}`, state };
}

export function verifyOutlookState(state) {
  try {
    const secret = process.env.JWT_SECRET || "your-secret";
    const decoded = jwt.verify(state, secret);
    if (decoded.purpose !== "tutor_mailbox_outlook") throw new Error("bad");
    return { tutorId: decoded.tutorId, tutorType: decoded.tutorType };
  } catch (e) {
    if (e instanceof ErrorClass) throw e;
    throw new ErrorClass("Invalid or expired OAuth state", 400);
  }
}

export async function exchangeOutlookCode(code) {
  const { clientId, clientSecret, redirectUri } = getOutlookConfig();
  if (!clientId || !clientSecret) {
    throw new ErrorClass("Microsoft mailbox client secret not configured.", 500);
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const { data } = await axios.post(`${MS_AUTH}/token`, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    scope: data.scope,
  };
}

async function graphRequest(mailbox, method, path, options = {}) {
  const { access_token, refresh_token } = getDecryptedTokens(mailbox);
  if (!access_token) throw new ErrorClass("Outlook token missing", 401);

  const tryReq = async (token) =>
    axios({
      method,
      url: path.startsWith("http") ? path : `${MS_GRAPH}${path}`,
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
      data: options.data,
      params: options.params,
    });

  try {
    return await tryReq(access_token);
  } catch (e) {
    if (e.response?.status !== 401 || !refresh_token) throw e;
    const { clientId, clientSecret, redirectUri } = getOutlookConfig();
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token,
      redirect_uri: redirectUri,
    });
    const { data } = await axios.post(`${MS_AUTH}/token`, body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    await storeEncryptedTokens(mailbox, {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refresh_token,
      expires_in: data.expires_in,
      scope: data.scope || mailbox.scope,
    });
    await mailbox.reload();
    return await tryReq(getDecryptedTokens(mailbox).access_token);
  }
}

export async function getOutlookProfileEmail(mailbox) {
  const res = await graphRequest(mailbox, "get", "/me", {});
  return res.data.mail || res.data.userPrincipalName;
}

export async function sendOutlookMail(mailbox, { to, cc, bcc, subject, bodyText, threadId }) {
  const payload = {
    message: {
      subject,
      body: { contentType: "Text", content: bodyText || "" },
      toRecipients: to.split(",").map((e) => ({
        emailAddress: { address: e.trim() },
      })),
    },
    saveToSentItems: true,
  };
  if (cc) {
    payload.message.ccRecipients = cc.split(",").map((e) => ({
      emailAddress: { address: e.trim() },
    }));
  }
  if (bcc) {
    payload.message.bccRecipients = bcc.split(",").map((e) => ({
      emailAddress: { address: e.trim() },
    }));
  }
  await graphRequest(mailbox, "post", "/me/sendMail", { data: payload });

  const list = await graphRequest(mailbox, "get", "/me/messages", {
    params: { $top: 1, $orderby: "sentDateTime desc" },
  });
  const msg = list.data?.value?.[0];
  if (!msg) return null;

  const extThread = msg.conversationId || msg.id;
  const [thread] = await MailThread.findOrCreate({
    where: {
      tutor_mailbox_id: mailbox.id,
      external_thread_id: extThread,
    },
    defaults: {
      tutor_mailbox_id: mailbox.id,
      tutor_id: mailbox.tutor_id,
      tutor_type: mailbox.tutor_type,
      subject,
      last_message_at: new Date(msg.sentDateTime || Date.now()),
      snippet: (bodyText || "").slice(0, 500),
    },
  });

  await MailMessage.create({
    thread_id: thread.id,
    tutor_mailbox_id: mailbox.id,
    direction: "sent",
    from_email: mailbox.email_address,
    to_email: to,
    cc: cc || null,
    bcc: bcc || null,
    subject,
    body_text: bodyText,
    provider_message_id: msg.id,
    rfc_message_id: msg.internetMessageId || null,
    sent_or_received_at: new Date(msg.sentDateTime || Date.now()),
    is_read: true,
    metadata: { graph: true },
  });

  return { threadId: thread.id, messageId: msg.id };
}

export async function syncOutlookMailbox(mailbox) {
  const res = await graphRequest(mailbox, "get", "/me/messages", {
    params: {
      $top: 40,
      $orderby: "receivedDateTime desc",
      $select: "id,conversationId,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead",
    },
  });
  const items = res.data?.value || [];
  for (const msg of items) {
    const extThread = msg.conversationId || msg.id;
    const fromAddr = msg.from?.emailAddress?.address || "";
    const toLine =
      (msg.toRecipients || []).map((r) => r.emailAddress?.address).filter(Boolean).join(", ") || "";
    const me = (mailbox.email_address || "").toLowerCase();
    const direction = fromAddr.toLowerCase() === me ? "sent" : "received";

    const [thread] = await MailThread.findOrCreate({
      where: { tutor_mailbox_id: mailbox.id, external_thread_id: extThread },
      defaults: {
        tutor_mailbox_id: mailbox.id,
        tutor_id: mailbox.tutor_id,
        tutor_type: mailbox.tutor_type,
        subject: msg.subject,
        last_message_at: new Date(msg.receivedDateTime || msg.sentDateTime || Date.now()),
        snippet: (msg.bodyPreview || "").slice(0, 500),
      },
    });

    await MailMessage.findOrCreate({
      where: { tutor_mailbox_id: mailbox.id, provider_message_id: msg.id },
      defaults: {
        thread_id: thread.id,
        tutor_mailbox_id: mailbox.id,
        direction,
        from_email: fromAddr,
        to_email: toLine,
        subject: msg.subject,
        body_text: msg.body?.content || msg.bodyPreview || "",
        body_html: msg.body?.contentType === "html" ? msg.body.content : null,
        provider_message_id: msg.id,
        rfc_message_id: msg.internetMessageId || null,
        is_read: !!msg.isRead,
        sent_or_received_at: new Date(msg.receivedDateTime || msg.sentDateTime || Date.now()),
        metadata: { graph: true },
      },
    });
  }
  await mailbox.update({ last_sync_at: new Date() });
}
