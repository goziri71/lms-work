/**
 * AES-256-GCM encryption for OAuth tokens at rest.
 * Set MAILBOX_TOKEN_ENCRYPTION_KEY to 64 hex chars (32 bytes), or a long random string (hashed).
 */

import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const TAG_LEN = 16;
const KEY_LEN = 32;

function getKey() {
  const raw = process.env.MAILBOX_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || "dev-only-change-me";
  return crypto.createHash("sha256").update(String(raw)).digest().subarray(0, KEY_LEN);
}

export function encryptToken(plain) {
  if (plain == null || plain === "") return "";
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptToken(encrypted) {
  if (!encrypted) return "";
  try {
    const buf = Buffer.from(String(encrypted), "base64");
    if (buf.length < IV_LEN + TAG_LEN + 1) return "";
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
