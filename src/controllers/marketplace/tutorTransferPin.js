import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { emailService } from "../../services/emailService.js";
import { Config } from "../../config/config.js";
import {
  generateSixDigitOtp,
  hashOtpForStorage,
  hashTransferPin,
  isValidOtpFormat,
  isValidPinFormat,
  MAX_OTP_FAILS,
  MAX_PIN_FAILS,
  OTP_TTL_MS,
  PIN_LOCK_MS,
  RESEND_COOLDOWN_MS,
  verifyOtp,
  verifyTransferPin,
} from "../../services/tutorTransferPinService.js";

function getTutorInfo(req) {
  const userType = req.user.userType;
  let tutorId;
  let tutorType;

  if (userType === "sole_tutor") {
    tutorId = req.tutor.id;
    tutorType = "sole_tutor";
  } else if (userType === "organization" || userType === "organization_user") {
    tutorId = req.tutor.id;
    tutorType = "organization";
  } else {
    throw new ErrorClass("Unauthorized: Tutor access required", 403);
  }

  return { tutorId, tutorType };
}

async function findTutor(tutorId, tutorType) {
  if (tutorType === "sole_tutor") {
    return SoleTutor.findByPk(tutorId);
  }
  return Organization.findByPk(tutorId);
}

function tutorEmailName(tutor, tutorType) {
  if (tutorType === "sole_tutor") {
    return {
      email: tutor.email,
      name: [tutor.fname, tutor.mname, tutor.lname].filter(Boolean).join(" ").trim() || tutor.email,
    };
  }
  return {
    email: tutor.email,
    name: tutor.name || tutor.email,
  };
}

function purposeLabel(purpose) {
  if (purpose === "setup") return "Set up your transfer PIN";
  if (purpose === "change") return "Change your transfer PIN";
  if (purpose === "reset") return "Reset your transfer PIN";
  return "Transfer PIN verification";
}

/**
 * GET /api/marketplace/tutor/transfer-pin/status
 */
export const getTransferPinStatus = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const tutor = await findTutor(tutorId, tutorType);
  if (!tutor) {
    throw new ErrorClass("Tutor not found", 404);
  }

  const configured = Boolean(tutor.transfer_pin_hash);
  const lockedUntil = tutor.transfer_pin_locked_until || null;
  const now = new Date();
  const locked =
    lockedUntil && new Date(lockedUntil) > now ? new Date(lockedUntil).toISOString() : null;

  res.status(200).json({
    success: true,
    data: {
      transfer_pin_configured: configured,
      transfer_pin_locked_until: locked,
      transfer_pin_enforced_by_policy: Config.transferPin?.enforce === true,
      must_set_transfer_pin:
        Config.transferPin?.enforce === true && !configured,
    },
  });
});

/**
 * POST /api/marketplace/tutor/transfer-pin/send-otp
 * body: { purpose: "setup" | "change" | "reset" }
 */
export const sendTransferPinOtp = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const purpose = (req.body?.purpose || "").toString().toLowerCase().trim();
  if (!["setup", "change", "reset"].includes(purpose)) {
    throw new ErrorClass('Invalid purpose. Use "setup", "change", or "reset".', 400);
  }

  const tutor = await findTutor(tutorId, tutorType);
  if (!tutor) {
    throw new ErrorClass("Tutor not found", 404);
  }

  if (tutor.transfer_pin_locked_until && new Date(tutor.transfer_pin_locked_until) > new Date()) {
    throw new ErrorClass(
      "Transfer PIN is temporarily locked. Try again later or use email verification after the lock expires.",
      423
    );
  }

  if (purpose === "setup" && tutor.transfer_pin_hash) {
    throw new ErrorClass("Transfer PIN is already set. Use change or reset.", 400);
  }
  if ((purpose === "change" || purpose === "reset") && !tutor.transfer_pin_hash) {
    throw new ErrorClass("Set up a transfer PIN first.", 400);
  }

  const lastSent = tutor.transfer_pin_otp_last_sent_at;
  if (lastSent && Date.now() - new Date(lastSent).getTime() < RESEND_COOLDOWN_MS) {
    throw new ErrorClass("Please wait before requesting another code.", 429);
  }

  const otp = generateSixDigitOtp();
  const otpHash = hashOtpForStorage(otp, tutorId, tutorType, purpose);
  const expires = new Date(Date.now() + OTP_TTL_MS);

  await tutor.update({
    transfer_pin_otp_hash: otpHash,
    transfer_pin_otp_expires_at: expires,
    transfer_pin_otp_purpose: purpose,
    transfer_pin_otp_last_sent_at: new Date(),
    transfer_pin_otp_failed_attempts: 0,
  });

  const { email, name } = tutorEmailName(tutor, tutorType);
  const sendResult = await emailService.sendTutorTransferPinOtp({
    to: email,
    name,
    code: otp,
    purposeLabel: purposeLabel(purpose),
  });

  if (!sendResult.success) {
    await tutor.update({
      transfer_pin_otp_hash: null,
      transfer_pin_otp_expires_at: null,
      transfer_pin_otp_purpose: null,
    });
    throw new ErrorClass(
      sendResult.message || "Could not send verification email. Check your email settings.",
      503
    );
  }

  res.status(200).json({
    success: true,
    message: "Verification code sent to your email.",
    data: { purpose, expires_at: expires.toISOString() },
  });
});

/**
 * POST /api/marketplace/tutor/transfer-pin/confirm
 * setup: { purpose, otp, pin }
 * change: { purpose, otp, current_pin, new_pin }
 * reset: { purpose, otp, new_pin }
 */
export const confirmTransferPin = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const purpose = (req.body?.purpose || "").toString().toLowerCase().trim();
  const otp = req.body?.otp;

  if (!["setup", "change", "reset"].includes(purpose)) {
    throw new ErrorClass('Invalid purpose.', 400);
  }
  if (!isValidOtpFormat(otp)) {
    throw new ErrorClass("Enter the 6-digit code from your email.", 400);
  }

  const tutor = await findTutor(tutorId, tutorType);
  if (!tutor) {
    throw new ErrorClass("Tutor not found", 404);
  }

  if (!tutor.transfer_pin_otp_hash || !tutor.transfer_pin_otp_expires_at || tutor.transfer_pin_otp_purpose !== purpose) {
    throw new ErrorClass("No pending verification. Request a new code.", 400);
  }

  if (new Date(tutor.transfer_pin_otp_expires_at) < new Date()) {
    await tutor.update({
      transfer_pin_otp_hash: null,
      transfer_pin_otp_expires_at: null,
      transfer_pin_otp_purpose: null,
    });
    throw new ErrorClass("Code expired. Request a new one.", 400);
  }

  const ok = verifyOtp(otp, tutor.transfer_pin_otp_hash, tutorId, tutorType, purpose);
  if (!ok) {
    const fails = (tutor.transfer_pin_otp_failed_attempts || 0) + 1;
    const patch = { transfer_pin_otp_failed_attempts: fails };
    if (fails >= MAX_OTP_FAILS) {
      patch.transfer_pin_otp_hash = null;
      patch.transfer_pin_otp_expires_at = null;
      patch.transfer_pin_otp_purpose = null;
      patch.transfer_pin_otp_failed_attempts = 0;
    }
    await tutor.update(patch);
    throw new ErrorClass("Invalid verification code.", 400);
  }

  const clearOtp = {
    transfer_pin_otp_hash: null,
    transfer_pin_otp_expires_at: null,
    transfer_pin_otp_purpose: null,
    transfer_pin_otp_last_sent_at: null,
    transfer_pin_otp_failed_attempts: 0,
  };

  if (purpose === "setup") {
    const pin = req.body?.pin;
    if (!isValidPinFormat(pin)) {
      throw new ErrorClass("PIN must be 4–6 digits.", 400);
    }
    await tutor.update({
      ...clearOtp,
      transfer_pin_hash: hashTransferPin(pin),
      transfer_pin_set_at: new Date(),
      transfer_pin_failed_attempts: 0,
      transfer_pin_locked_until: null,
    });
    return res.status(200).json({
      success: true,
      message: "Transfer PIN set successfully.",
    });
  }

  if (purpose === "reset") {
    const newPin = req.body?.new_pin;
    if (!isValidPinFormat(newPin)) {
      throw new ErrorClass("New PIN must be 4–6 digits.", 400);
    }
    await tutor.update({
      ...clearOtp,
      transfer_pin_hash: hashTransferPin(newPin),
      transfer_pin_set_at: new Date(),
      transfer_pin_failed_attempts: 0,
      transfer_pin_locked_until: null,
    });
    return res.status(200).json({
      success: true,
      message: "Transfer PIN reset successfully.",
    });
  }

  // change
  const currentPin = req.body?.current_pin;
  const newPin = req.body?.new_pin;
  if (!isValidPinFormat(currentPin) || !isValidPinFormat(newPin)) {
    throw new ErrorClass("Current and new PIN must be 4–6 digits.", 400);
  }
  if (currentPin === newPin) {
    throw new ErrorClass("New PIN must be different from the current PIN.", 400);
  }
  if (!verifyTransferPin(currentPin, tutor.transfer_pin_hash)) {
    throw new ErrorClass("Current PIN is incorrect.", 400);
  }

  await tutor.update({
    ...clearOtp,
    transfer_pin_hash: hashTransferPin(newPin),
    transfer_pin_set_at: new Date(),
    transfer_pin_failed_attempts: 0,
    transfer_pin_locked_until: null,
  });

  res.status(200).json({
    success: true,
    message: "Transfer PIN changed successfully.",
  });
});

/**
 * Used by payout controller: verify body.transfer_pin when required.
 * Mutates failed attempt / lock on the tutor row (caller must pass locked instance after reload).
 */
export async function assertTransferPinForPayout(tutor, tutorId, tutorType, transferPinFromBody) {
  const hash = tutor.transfer_pin_hash;
  const enforced = Config.transferPin?.enforce === true;

  if (enforced && !hash) {
    throw new ErrorClass(
      "Transfer PIN is required. Set it under security settings before requesting a payout.",
      403
    );
  }

  if (!hash) {
    return;
  }

  const pin = transferPinFromBody;
  if (pin == null || String(pin).trim() === "") {
    throw new ErrorClass("transfer_pin is required for payouts.", 400);
  }

  if (tutor.transfer_pin_locked_until && new Date(tutor.transfer_pin_locked_until) > new Date()) {
    throw new ErrorClass(
      "Too many failed attempts. Transfer PIN is temporarily locked.",
      423
    );
  }

  if (!verifyTransferPin(pin, hash)) {
    const fails = (tutor.transfer_pin_failed_attempts || 0) + 1;
    const patch = { transfer_pin_failed_attempts: fails };
    if (fails >= MAX_PIN_FAILS) {
      patch.transfer_pin_locked_until = new Date(Date.now() + PIN_LOCK_MS);
      patch.transfer_pin_failed_attempts = 0;
    }
    await tutor.update(patch);
    throw new ErrorClass("Invalid transfer PIN.", 400);
  }

  if ((tutor.transfer_pin_failed_attempts || 0) > 0) {
    await tutor.update({ transfer_pin_failed_attempts: 0 });
  }
}
