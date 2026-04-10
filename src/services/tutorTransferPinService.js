import crypto from "crypto";
import bcrypt from "bcrypt";
import { Config } from "../config/config.js";

const BCRYPT_ROUNDS = 10;
const OTP_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 90 * 1000;
const MAX_PIN_FAILS = 5;
const PIN_LOCK_MS = 30 * 60 * 1000;
const MAX_OTP_FAILS = 5;

/** @returns {boolean} */
export function isValidPinFormat(pin) {
  if (pin == null || typeof pin !== "string") return false;
  return /^\d{4,6}$/.test(pin.trim());
}

/** @returns {boolean} */
export function isValidOtpFormat(otp) {
  if (otp == null || typeof otp !== "string") return false;
  return /^\d{6}$/.test(otp.trim());
}

export function hashTransferPin(pin) {
  return bcrypt.hashSync(String(pin).trim(), BCRYPT_ROUNDS);
}

export function verifyTransferPin(pin, hash) {
  if (!hash || !pin) return false;
  return bcrypt.compareSync(String(pin).trim(), hash);
}

function otpPepper() {
  return Config.JWT_SECRET || "transfer-pin-otp-fallback";
}

/**
 * @param {string} otp
 * @param {number} tutorId
 * @param {"sole_tutor"|"organization"} tutorType
 * @param {string} purpose
 */
export function hashOtpForStorage(otp, tutorId, tutorType, purpose) {
  return crypto
    .createHmac("sha256", otpPepper())
    .update(`${tutorId}|${tutorType}|${purpose}|${String(otp).trim()}`)
    .digest("hex");
}

export function verifyOtp(otp, storedHash, tutorId, tutorType, purpose) {
  if (!storedHash || !otp) return false;
  const h = hashOtpForStorage(otp, tutorId, tutorType, purpose);
  try {
    return crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

export function generateSixDigitOtp() {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

export { OTP_TTL_MS, RESEND_COOLDOWN_MS, MAX_PIN_FAILS, PIN_LOCK_MS, MAX_OTP_FAILS };
