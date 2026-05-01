import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { logAdminActivity } from "../../middlewares/adminAuthorize.js";
import { TutorAccessCode } from "../../models/marketplace/tutorAccessCode.js";
import {
  generateRawTutorAccessCode,
  hashAccessCode,
  normalizeAccessCodeInput,
} from "../../utils/tutorAccessCode.js";

/**
 * POST /api/admin/tutor-access-codes
 * Body: { valid_until?: ISO string, duration_months?: number (1–24, default 3) }
 * Returns the plain code once in `data.code` (store it securely; only hash is saved).
 */
export const createTutorAccessCode = TryCatchFunction(async (req, res) => {
  const { valid_until, duration_months: rawMonths } = req.body;
  const duration_months = Math.min(
    24,
    Math.max(1, parseInt(String(rawMonths ?? 3), 10) || 3),
  );

  let validUntilDate = null;
  if (valid_until != null && String(valid_until).trim() !== "") {
    validUntilDate = new Date(valid_until);
    if (Number.isNaN(validUntilDate.getTime())) {
      throw new ErrorClass("valid_until must be a valid date", 400);
    }
  }

  const adminId = req.user.id;
  let plainCode = null;
  let record = null;

  for (let attempt = 0; attempt < 15; attempt++) {
    plainCode = generateRawTutorAccessCode();
    const normalized = normalizeAccessCodeInput(plainCode);
    const code_hash = hashAccessCode(normalized);
    const code_hint = normalized.slice(-4);

    try {
      record = await TutorAccessCode.create({
        code_hash,
        code_hint,
        status: "active",
        valid_until: validUntilDate,
        duration_months,
        created_by_admin_id: adminId,
      });
      break;
    } catch (e) {
      if (e?.name === "SequelizeUniqueConstraintError") continue;
      throw e;
    }
  }

  if (!record) {
    throw new ErrorClass("Could not generate a unique code. Try again.", 500);
  }

  await logAdminActivity(
    adminId,
    "created_tutor_access_code",
    "tutor_access_code",
    record.id,
    {
      valid_until: validUntilDate,
      duration_months,
    },
  );

  res.status(201).json({
    success: true,
    message:
      "Access code created. Copy it now; it will not be shown again in full.",
    data: {
      id: record.id,
      code: plainCode,
      code_hint: record.code_hint,
      status: record.status,
      valid_until: record.valid_until,
      duration_months: record.duration_months,
      created_at: record.created_at,
    },
  });
});

/**
 * GET /api/admin/tutor-access-codes
 */
export const listTutorAccessCodes = TryCatchFunction(async (req, res) => {
  const limit = Math.min(
    200,
    Math.max(1, parseInt(String(req.query.limit ?? 50), 10) || 50),
  );

  const rows = await TutorAccessCode.findAll({
    order: [["created_at", "DESC"]],
    limit,
  });

  res.json({
    success: true,
    data: {
      codes: rows.map((r) => ({
        id: r.id,
        code_hint: r.code_hint,
        status: r.status,
        valid_until: r.valid_until,
        duration_months: r.duration_months,
        redeemed_at: r.redeemed_at,
        redeemed_tutor_id: r.redeemed_tutor_id,
        redeemed_tutor_type: r.redeemed_tutor_type,
        created_by_admin_id: r.created_by_admin_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      count: rows.length,
    },
  });
});

/**
 * POST /api/admin/tutor-access-codes/:id/revoke
 */
export const revokeTutorAccessCode = TryCatchFunction(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    throw new ErrorClass("Invalid code id", 400);
  }

  const row = await TutorAccessCode.findByPk(id);
  if (!row) {
    throw new ErrorClass("Access code not found", 404);
  }

  if (row.status === "redeemed") {
    throw new ErrorClass("This code was already redeemed and cannot be revoked.", 400);
  }

  if (row.status === "revoked") {
    return res.json({
      success: true,
      message: "Code was already revoked.",
      data: { id: row.id, status: row.status },
    });
  }

  await row.update({ status: "revoked" });

  await logAdminActivity(
    req.user.id,
    "revoked_tutor_access_code",
    "tutor_access_code",
    id,
    {},
  );

  res.json({
    success: true,
    message: "Access code revoked.",
    data: { id: row.id, status: "revoked" },
  });
});
