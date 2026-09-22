/**
 * Organization KYC Controller
 * Business info + CAC / company document uploads for organization accounts
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { OrganizationKyc } from "../../models/marketplace/organizationKyc.js";
import { Organization } from "../../models/marketplace/organization.js";
import { supabase } from "../../utils/supabase.js";
import multer from "multer";

const ALLOWED_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const DOCUMENT_FIELDS = [
  "cac_certificate",
  "cac_status_report",
  "memorandum_articles",
  "proof_of_address",
  "tax_document",
  "authorized_rep_id",
];

const FIELD_TO_COLUMN = {
  cac_certificate: "cac_certificate_url",
  cac_status_report: "cac_status_report_url",
  memorandum_articles: "memorandum_articles_url",
  proof_of_address: "proof_of_address_url",
  tax_document: "tax_document_url",
  authorized_rep_id: "authorized_rep_id_url",
};

const VALID_BUSINESS_TYPES = [
  "limited_company",
  "business_name",
  "ngo",
  "partnership",
  "sole_proprietorship",
  "other",
];

const orgKycUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else
      cb(
        new ErrorClass(
          `Invalid file type. Allowed: ${ALLOWED_MIMES.join(", ")}`,
          400
        ),
        false
      );
  },
});

export const uploadOrgKycDocumentsMiddleware = orgKycUploader.fields(
  DOCUMENT_FIELDS.map((name) => ({ name, maxCount: 1 }))
);

function assertOrganizationAccount(req) {
  const userType = req.user?.userType;
  if (userType !== "organization") {
    throw new ErrorClass(
      "Organization KYC is only available for organization accounts (not organization users)",
      403
    );
  }
  const organizationId = req.tutor?.id;
  if (!organizationId) {
    throw new ErrorClass("Organization authentication required", 401);
  }
  return organizationId;
}

async function ensurePrivateBucket(bucket) {
  try {
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets();
    if (listError) return;
    const exists = buckets?.some((b) => b.name === bucket);
    if (exists) return;
    const { error: createError } = await supabase.storage.createBucket(bucket, {
      public: false,
      allowedMimeTypes: ALLOWED_MIMES,
      fileSizeLimit: 10 * 1024 * 1024,
    });
    if (createError) {
      throw new ErrorClass(
        `Storage bucket "${bucket}" does not exist and could not be created: ${createError.message}`,
        500
      );
    }
  } catch (err) {
    if (err instanceof ErrorClass) throw err;
    console.warn("Could not verify org KYC bucket:", err.message);
  }
}

async function uploadOrgDoc(bucket, organizationId, fieldName, file) {
  const fileExt = file.originalname.split(".").pop().toLowerCase();
  const fileName = `org-kyc/${organizationId}/${fieldName}_${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    if (
      error.message?.includes("Bucket not found") ||
      error.message?.includes("not found")
    ) {
      throw new ErrorClass(
        `Storage bucket "${bucket}" does not exist. Create it in Supabase Storage.`,
        500
      );
    }
    throw new ErrorClass(`${fieldName} upload failed: ${error.message}`, 500);
  }

  const { data: signedUrlData } = await supabase.storage
    .from(bucket)
    .createSignedUrl(fileName, 31536000);

  return {
    column: FIELD_TO_COLUMN[fieldName],
    url: signedUrlData?.signedUrl || null,
    path: fileName,
  };
}

function formatOrgKycSummary(kyc) {
  return {
    id: kyc.id,
    kyc_type: "organization",
    status: kyc.status,
    business_name: kyc.business_name,
    cac_number: kyc.cac_number,
    submitted_at: kyc.submitted_at,
    reviewed_at: kyc.reviewed_at,
    rejection_reason: kyc.rejection_reason,
    resubmission_notes: kyc.resubmission_notes,
    notes: kyc.notes,
    documents: {
      cac_certificate: !!kyc.cac_certificate_url,
      cac_status_report: !!kyc.cac_status_report_url,
      memorandum_articles: !!kyc.memorandum_articles_url,
      proof_of_address: !!kyc.proof_of_address_url,
      tax_document: !!kyc.tax_document_url,
      authorized_rep_id: !!kyc.authorized_rep_id_url,
      additional_documents: Array.isArray(kyc.additional_documents)
        ? kyc.additional_documents.length
        : 0,
    },
  };
}

/**
 * GET organization KYC status
 */
export const getOrganizationKycStatus = TryCatchFunction(async (req, res) => {
  const organizationId = assertOrganizationAccount(req);

  const kyc = await OrganizationKyc.findOne({
    where: { organization_id: organizationId },
    include: [
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "email", "phone", "verification_status"],
      },
    ],
  });

  if (!kyc) {
    return res.status(200).json({
      success: true,
      message: "No KYC submission found",
      data: {
        kyc: null,
        status: "not_submitted",
        kyc_type: "organization",
      },
    });
  }

  res.status(200).json({
    success: true,
    message: "KYC status retrieved successfully",
    data: {
      kyc: formatOrgKycSummary(kyc),
      status: kyc.status,
      kyc_type: "organization",
    },
  });
});

/**
 * POST/PUT organization KYC (business info + docs)
 */
export const submitOrganizationKyc = TryCatchFunction(async (req, res) => {
  const organizationId = assertOrganizationAccount(req);
  const body = req.body || {};

  const {
    business_name,
    trading_name,
    business_type,
    cac_number,
    tin,
    date_of_incorporation,
    registered_address,
    operating_address,
    business_email,
    business_phone,
    nature_of_business,
    directors: directorsRaw,
    additional_documents: additionalDocsJson,
  } = body;

  if (business_type && !VALID_BUSINESS_TYPES.includes(business_type)) {
    throw new ErrorClass(
      `Invalid business_type. Must be one of: ${VALID_BUSINESS_TYPES.join(", ")}`,
      400
    );
  }

  let kyc = await OrganizationKyc.findOne({
    where: { organization_id: organizationId },
  });
  const isUpdate = !!kyc;

  if (!kyc) {
    kyc = await OrganizationKyc.create({
      organization_id: organizationId,
      status: "pending",
    });
  }

  if (kyc.status === "approved") {
    throw new ErrorClass(
      "KYC is already approved. Contact support to change verified details.",
      400
    );
  }

  const bucket =
    process.env.ORGANIZATION_DOCUMENTS_BUCKET ||
    process.env.TUTOR_DOCUMENTS_BUCKET ||
    "tutor-documents";

  await ensurePrivateBucket(bucket);

  const uploadPromises = [];
  for (const field of DOCUMENT_FIELDS) {
    const files = req.files?.[field];
    if (files?.length > 0) {
      uploadPromises.push(
        uploadOrgDoc(bucket, organizationId, field, files[0])
      );
    }
  }
  const uploadResults = await Promise.all(uploadPromises);

  let directors = null;
  if (directorsRaw != null) {
    try {
      directors =
        typeof directorsRaw === "string"
          ? JSON.parse(directorsRaw)
          : directorsRaw;
      if (!Array.isArray(directors)) {
        throw new Error("directors must be an array");
      }
    } catch {
      throw new ErrorClass(
        "directors must be a JSON array of { name, role, ... }",
        400
      );
    }
  }

  let additionalDocuments = kyc.additional_documents;
  if (additionalDocsJson != null) {
    try {
      additionalDocuments =
        typeof additionalDocsJson === "string"
          ? JSON.parse(additionalDocsJson)
          : additionalDocsJson;
    } catch {
      console.error("Error parsing additional_documents");
    }
  }

  const updateData = {
    status: "pending",
    submitted_at: new Date(),
    rejection_reason: null,
  };

  if (business_name !== undefined) updateData.business_name = business_name || null;
  if (trading_name !== undefined) updateData.trading_name = trading_name || null;
  if (business_type !== undefined) updateData.business_type = business_type || null;
  if (cac_number !== undefined) updateData.cac_number = cac_number || null;
  if (tin !== undefined) updateData.tin = tin || null;
  if (date_of_incorporation !== undefined) {
    updateData.date_of_incorporation = date_of_incorporation || null;
  }
  if (registered_address !== undefined) {
    updateData.registered_address = registered_address || null;
  }
  if (operating_address !== undefined) {
    updateData.operating_address = operating_address || null;
  }
  if (business_email !== undefined) {
    updateData.business_email = business_email || null;
  }
  if (business_phone !== undefined) {
    updateData.business_phone = business_phone || null;
  }
  if (nature_of_business !== undefined) {
    updateData.nature_of_business = nature_of_business || null;
  }
  if (directors !== null) updateData.directors = directors;
  if (additionalDocsJson != null) {
    updateData.additional_documents = additionalDocuments;
  }

  for (const result of uploadResults) {
    if (result.column && result.url) {
      updateData[result.column] = result.url;
    }
  }

  const nextBusinessName = updateData.business_name ?? kyc.business_name;
  const nextCac = updateData.cac_number ?? kyc.cac_number;
  const hasCacCertificate =
    !!kyc.cac_certificate_url ||
    uploadResults.some((r) => r.column === "cac_certificate_url" && r.url);

  if (!nextBusinessName || !nextCac) {
    throw new ErrorClass(
      "business_name and cac_number are required for organization KYC",
      400
    );
  }
  if (!hasCacCertificate) {
    throw new ErrorClass(
      "cac_certificate document is required (upload field: cac_certificate)",
      400
    );
  }

  await kyc.update(updateData);
  await kyc.reload();

  // Keep org profile registration fields in sync when provided
  const orgUpdates = {};
  if (updateData.cac_number) orgUpdates.registration_number = updateData.cac_number;
  if (updateData.tin) orgUpdates.tax_id = updateData.tin;
  if (Object.keys(orgUpdates).length) {
    await Organization.update(orgUpdates, { where: { id: organizationId } });
  }

  res.status(isUpdate ? 200 : 201).json({
    success: true,
    message: isUpdate
      ? "Organization KYC updated successfully"
      : "Organization KYC submitted successfully",
    data: {
      kyc: formatOrgKycSummary(kyc),
      kyc_type: "organization",
    },
  });
});
