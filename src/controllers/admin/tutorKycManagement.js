/**
 * Admin Tutor KYC Management Controller
 * Handles KYC review and approval by admins
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TutorKyc } from "../../models/marketplace/tutorKyc.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Op } from "sequelize";

/**
 * Get all KYC submissions with filters
 * GET /api/admin/tutor-kyc
 */
export const getAllKycSubmissions = TryCatchFunction(async (req, res) => {
  const userType = req.user?.userType;

  if (userType !== "admin" && userType !== "super_admin") {
    throw new ErrorClass("Only admins can view KYC submissions", 403);
  }

  const { status, page = 1, limit = 20, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (status) {
    where.status = status;
  }

  // Search by tutor name or email
  let tutorWhere = {};
  if (search) {
    tutorWhere = {
      [Op.or]: [
        { fname: { [Op.iLike]: `%${search}%` } },
        { lname: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ],
    };
  }

  const { count, rows: kycSubmissions } = await TutorKyc.findAndCountAll({
    where,
    include: [
      {
        model: SoleTutor,
        as: "tutor",
        attributes: ["id", "fname", "lname", "email", "phone", "status"],
        where: tutorWhere,
        required: true,
      },
    ],
    limit: parseInt(limit),
    offset,
    order: [["submitted_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "KYC submissions retrieved successfully",
    data: {
      submissions: kycSubmissions.map((kyc) => ({
        id: kyc.id,
        tutor: {
          id: kyc.tutor.id,
          name: `${kyc.tutor.fname} ${kyc.tutor.lname}`,
          email: kyc.tutor.email,
          phone: kyc.tutor.phone,
        },
        status: kyc.status,
        bvn_verified: kyc.bvn_verified,
        submitted_at: kyc.submitted_at,
        reviewed_at: kyc.reviewed_at,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

/**
 * Get single KYC submission by ID
 * GET /api/admin/tutor-kyc/:id
 */
export const getKycSubmissionById = TryCatchFunction(async (req, res) => {
  const userType = req.user?.userType;

  if (userType !== "admin" && userType !== "super_admin") {
    throw new ErrorClass("Only admins can view KYC submissions", 403);
  }

  const { id } = req.params;

  const kyc = await TutorKyc.findByPk(id, {
    include: [
      {
        model: SoleTutor,
        as: "tutor",
        attributes: ["id", "fname", "lname", "mname", "email", "phone", "status"],
      },
    ],
  });

  if (!kyc) {
    throw new ErrorClass("KYC submission not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "KYC submission retrieved successfully",
    data: {
      kyc: {
        id: kyc.id,
        tutor: kyc.tutor,
        bvn: kyc.bvn,
        bvn_verified: kyc.bvn_verified,
        bvn_verification_date: kyc.bvn_verification_date,
        first_name: kyc.first_name,
        last_name: kyc.last_name,
        date_of_birth: kyc.date_of_birth,
        phone_number: kyc.phone_number,
        national_id_type: kyc.national_id_type,
        national_id_number: kyc.national_id_number,
        national_id_url: kyc.national_id_url,
        proof_of_address_url: kyc.proof_of_address_url,
        passport_photo_url: kyc.passport_photo_url,
        additional_documents: kyc.additional_documents,
        status: kyc.status,
        submitted_at: kyc.submitted_at,
        reviewed_at: kyc.reviewed_at,
        reviewed_by: kyc.reviewed_by,
        rejection_reason: kyc.rejection_reason,
        resubmission_notes: kyc.resubmission_notes,
        notes: kyc.notes,
      },
    },
  });
});

/**
 * Approve KYC submission
 * PUT /api/admin/tutor-kyc/:id/approve
 */
export const approveKyc = TryCatchFunction(async (req, res) => {
  const adminId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "admin" && userType !== "super_admin") {
    throw new ErrorClass("Only admins can approve KYC submissions", 403);
  }

  const { id } = req.params;
  const { notes } = req.body;

  const kyc = await TutorKyc.findByPk(id, {
    include: [
      {
        model: SoleTutor,
        as: "tutor",
      },
    ],
  });

  if (!kyc) {
    throw new ErrorClass("KYC submission not found", 404);
  }

  if (kyc.status === "approved") {
    throw new ErrorClass("KYC is already approved", 400);
  }

  await kyc.update({
    status: "approved",
    reviewed_at: new Date(),
    reviewed_by: adminId,
    notes: notes || kyc.notes,
    rejection_reason: null,
    resubmission_notes: null,
  });

  res.status(200).json({
    success: true,
    message: "KYC approved successfully",
    data: {
      kyc: {
        id: kyc.id,
        status: kyc.status,
        reviewed_at: kyc.reviewed_at,
      },
    },
  });
});

/**
 * Reject KYC submission
 * PUT /api/admin/tutor-kyc/:id/reject
 */
export const rejectKyc = TryCatchFunction(async (req, res) => {
  const adminId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "admin" && userType !== "super_admin") {
    throw new ErrorClass("Only admins can reject KYC submissions", 403);
  }

  const { id } = req.params;
  const { rejection_reason, notes } = req.body;

  if (!rejection_reason) {
    throw new ErrorClass("Rejection reason is required", 400);
  }

  const kyc = await TutorKyc.findByPk(id);

  if (!kyc) {
    throw new ErrorClass("KYC submission not found", 404);
  }

  if (kyc.status === "approved") {
    throw new ErrorClass("Cannot reject an approved KYC", 400);
  }

  await kyc.update({
    status: "rejected",
    reviewed_at: new Date(),
    reviewed_by: adminId,
    rejection_reason,
    notes: notes || kyc.notes,
    resubmission_notes: null,
  });

  res.status(200).json({
    success: true,
    message: "KYC rejected successfully",
    data: {
      kyc: {
        id: kyc.id,
        status: kyc.status,
        rejection_reason: kyc.rejection_reason,
        reviewed_at: kyc.reviewed_at,
      },
    },
  });
});

/**
 * Request KYC resubmission
 * PUT /api/admin/tutor-kyc/:id/request-resubmission
 */
export const requestKycResubmission = TryCatchFunction(async (req, res) => {
  const adminId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "admin" && userType !== "super_admin") {
    throw new ErrorClass("Only admins can request KYC resubmission", 403);
  }

  const { id } = req.params;
  const { resubmission_notes, notes } = req.body;

  if (!resubmission_notes) {
    throw new ErrorClass("Resubmission notes are required", 400);
  }

  const kyc = await TutorKyc.findByPk(id);

  if (!kyc) {
    throw new ErrorClass("KYC submission not found", 404);
  }

  if (kyc.status === "approved") {
    throw new ErrorClass("Cannot request resubmission for an approved KYC", 400);
  }

  await kyc.update({
    status: "requires_resubmission",
    reviewed_at: new Date(),
    reviewed_by: adminId,
    resubmission_notes,
    notes: notes || kyc.notes,
    rejection_reason: null,
  });

  res.status(200).json({
    success: true,
    message: "KYC resubmission requested successfully",
    data: {
      kyc: {
        id: kyc.id,
        status: kyc.status,
        resubmission_notes: kyc.resubmission_notes,
        reviewed_at: kyc.reviewed_at,
      },
    },
  });
});

/**
 * Get pending KYC submissions count
 * GET /api/admin/tutor-kyc/stats
 */
export const getKycStats = TryCatchFunction(async (req, res) => {
  const userType = req.user?.userType;

  if (userType !== "admin" && userType !== "super_admin") {
    throw new ErrorClass("Only admins can view KYC statistics", 403);
  }

  const [pending, underReview, approved, rejected, requiresResubmission] = await Promise.all([
    TutorKyc.count({ where: { status: "pending" } }),
    TutorKyc.count({ where: { status: "under_review" } }),
    TutorKyc.count({ where: { status: "approved" } }),
    TutorKyc.count({ where: { status: "rejected" } }),
    TutorKyc.count({ where: { status: "requires_resubmission" } }),
  ]);

  res.status(200).json({
    success: true,
    message: "KYC statistics retrieved successfully",
    data: {
      stats: {
        pending,
        under_review: underReview,
        approved,
        rejected,
        requires_resubmission: requiresResubmission,
        total: pending + underReview + approved + rejected + requiresResubmission,
      },
    },
  });
});
