/**
 * Admin Organization KYC Management
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { OrganizationKyc } from "../../models/marketplace/organizationKyc.js";
import { Organization } from "../../models/marketplace/organization.js";
import { Op } from "sequelize";

function assertAdmin(req) {
  const userType = req.user?.userType;
  if (userType !== "admin" && userType !== "super_admin") {
    throw new ErrorClass("Only admins can manage organization KYC", 403);
  }
}

/**
 * GET /api/admin/organization-kyc
 */
export const getAllOrgKycSubmissions = TryCatchFunction(async (req, res) => {
  assertAdmin(req);

  const { status, page = 1, limit = 20, search } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const where = {};
  if (status) where.status = status;

  let orgWhere = {};
  if (search) {
    orgWhere = {
      [Op.or]: [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ],
    };
  }

  const { count, rows } = await OrganizationKyc.findAndCountAll({
    where,
    include: [
      {
        model: Organization,
        as: "organization",
        attributes: [
          "id",
          "name",
          "email",
          "phone",
          "status",
          "verification_status",
        ],
        where: orgWhere,
        required: true,
      },
    ],
    limit: parseInt(limit, 10),
    offset,
    order: [["submitted_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Organization KYC submissions retrieved successfully",
    data: {
      submissions: rows.map((kyc) => ({
        id: kyc.id,
        kyc_type: "organization",
        organization: {
          id: kyc.organization.id,
          name: kyc.organization.name,
          email: kyc.organization.email,
          phone: kyc.organization.phone,
          verification_status: kyc.organization.verification_status,
        },
        business_name: kyc.business_name,
        cac_number: kyc.cac_number,
        status: kyc.status,
        submitted_at: kyc.submitted_at,
        reviewed_at: kyc.reviewed_at,
      })),
      pagination: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / parseInt(limit, 10)),
      },
    },
  });
});

/**
 * GET /api/admin/organization-kyc/:id
 */
export const getOrgKycSubmissionById = TryCatchFunction(async (req, res) => {
  assertAdmin(req);

  const kyc = await OrganizationKyc.findByPk(req.params.id, {
    include: [
      {
        model: Organization,
        as: "organization",
        attributes: [
          "id",
          "name",
          "email",
          "phone",
          "address",
          "country",
          "registration_number",
          "tax_id",
          "status",
          "verification_status",
        ],
      },
    ],
  });

  if (!kyc) throw new ErrorClass("Organization KYC submission not found", 404);

  res.status(200).json({
    success: true,
    message: "Organization KYC submission retrieved successfully",
    data: {
      kyc: {
        id: kyc.id,
        kyc_type: "organization",
        organization: kyc.organization,
        business_name: kyc.business_name,
        trading_name: kyc.trading_name,
        business_type: kyc.business_type,
        cac_number: kyc.cac_number,
        tin: kyc.tin,
        date_of_incorporation: kyc.date_of_incorporation,
        registered_address: kyc.registered_address,
        operating_address: kyc.operating_address,
        business_email: kyc.business_email,
        business_phone: kyc.business_phone,
        nature_of_business: kyc.nature_of_business,
        directors: kyc.directors,
        cac_certificate_url: kyc.cac_certificate_url,
        cac_status_report_url: kyc.cac_status_report_url,
        memorandum_articles_url: kyc.memorandum_articles_url,
        proof_of_address_url: kyc.proof_of_address_url,
        tax_document_url: kyc.tax_document_url,
        authorized_rep_id_url: kyc.authorized_rep_id_url,
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
 * PUT /api/admin/organization-kyc/:id/approve
 */
export const approveOrgKyc = TryCatchFunction(async (req, res) => {
  assertAdmin(req);
  const adminId = req.user?.id;
  const { notes } = req.body || {};

  const kyc = await OrganizationKyc.findByPk(req.params.id);
  if (!kyc) throw new ErrorClass("Organization KYC submission not found", 404);
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

  await Organization.update(
    { verification_status: "verified" },
    { where: { id: kyc.organization_id } }
  );

  res.status(200).json({
    success: true,
    message: "Organization KYC approved successfully",
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
 * PUT /api/admin/organization-kyc/:id/reject
 */
export const rejectOrgKyc = TryCatchFunction(async (req, res) => {
  assertAdmin(req);
  const adminId = req.user?.id;
  const { rejection_reason, notes } = req.body || {};

  if (!rejection_reason) {
    throw new ErrorClass("Rejection reason is required", 400);
  }

  const kyc = await OrganizationKyc.findByPk(req.params.id);
  if (!kyc) throw new ErrorClass("Organization KYC submission not found", 404);
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

  await Organization.update(
    { verification_status: "rejected" },
    { where: { id: kyc.organization_id } }
  );

  res.status(200).json({
    success: true,
    message: "Organization KYC rejected successfully",
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
 * PUT /api/admin/organization-kyc/:id/request-resubmission
 */
export const requestOrgKycResubmission = TryCatchFunction(async (req, res) => {
  assertAdmin(req);
  const adminId = req.user?.id;
  const { resubmission_notes, notes } = req.body || {};

  if (!resubmission_notes) {
    throw new ErrorClass("Resubmission notes are required", 400);
  }

  const kyc = await OrganizationKyc.findByPk(req.params.id);
  if (!kyc) throw new ErrorClass("Organization KYC submission not found", 404);
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

  await Organization.update(
    { verification_status: "unverified" },
    { where: { id: kyc.organization_id } }
  );

  res.status(200).json({
    success: true,
    message: "Organization KYC resubmission requested successfully",
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
 * GET /api/admin/organization-kyc/stats
 */
export const getOrgKycStats = TryCatchFunction(async (req, res) => {
  assertAdmin(req);

  const [pending, underReview, approved, rejected, requiresResubmission] =
    await Promise.all([
      OrganizationKyc.count({ where: { status: "pending" } }),
      OrganizationKyc.count({ where: { status: "under_review" } }),
      OrganizationKyc.count({ where: { status: "approved" } }),
      OrganizationKyc.count({ where: { status: "rejected" } }),
      OrganizationKyc.count({ where: { status: "requires_resubmission" } }),
    ]);

  res.status(200).json({
    success: true,
    message: "Organization KYC statistics retrieved successfully",
    data: {
      stats: {
        pending,
        under_review: underReview,
        approved,
        rejected,
        requires_resubmission: requiresResubmission,
        total:
          pending + underReview + approved + rejected + requiresResubmission,
      },
    },
  });
});
