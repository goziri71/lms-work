import crypto from "crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRawTutorAccessCode() {
  const part = (len) =>
    Array.from({ length: len }, () =>
      CODE_ALPHABET.charAt(crypto.randomInt(0, CODE_ALPHABET.length)),
    ).join("");
  return `${part(4)}-${part(4)}-${part(4)}`;
}

export function normalizeAccessCodeInput(input) {
  return String(input || "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

export function hashAccessCode(normalized) {
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}
