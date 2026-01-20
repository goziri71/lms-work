/**
 * Tutor KYC Controller
 * Handles KYC submission and document uploads for sole tutors
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TutorKyc } from "../../models/marketplace/tutorKyc.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { supabase } from "../../utils/supabase.js";
import { verifyBVN, validateBVNFormat } from "../../services/bvnVerificationService.js";
import multer from "multer";

// Configure multer for KYC document uploads
const kycDocumentUploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    const allowedMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ErrorClass(
          `Invalid file type. Allowed types: ${allowedMimes.join(", ")}`,
          400
        ),
        false
      );
    }
  },
});

// Middleware for KYC document uploads (multiple files)
export const uploadKycDocumentsMiddleware = kycDocumentUploader.fields([
  { name: "national_id", maxCount: 1 },
  { name: "proof_of_address", maxCount: 1 },
  { name: "passport_photo", maxCount: 1 },
]);

/**
 * Get KYC status for current tutor
 * GET /api/marketplace/tutor/kyc
 */
export const getKycStatus = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const userType = req.user?.userType;

  if (userType !== "sole_tutor") {
    throw new ErrorClass("KYC is only available for sole tutors", 403);
  }

  const kyc = await TutorKyc.findOne({
    where: {
      tutor_id: tutorId,
    },
    include: [
      {
        model: SoleTutor,
        as: "tutor",
        attributes: ["id", "fname", "lname", "email", "phone"],
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
      },
    });
  }

  res.status(200).json({
    success: true,
    message: "KYC status retrieved successfully",
    data: {
      kyc: {
        id: kyc.id,
        status: kyc.status,
        bvn_verified: kyc.bvn_verified,
        submitted_at: kyc.submitted_at,
        reviewed_at: kyc.reviewed_at,
        rejection_reason: kyc.rejection_reason,
        resubmission_notes: kyc.resubmission_notes,
        notes: kyc.notes,
      },
    },
  });
});

/**
 * Submit or update KYC information
 * POST /api/marketplace/tutor/kyc
 * PUT /api/marketplace/tutor/kyc
 */
export const submitKyc = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const userType = req.user?.userType;

  if (userType !== "sole_tutor") {
    throw new ErrorClass("KYC is only available for sole tutors", 403);
  }

  // Handle both JSON and multipart/form-data requests
  const body = req.body || {};
  const {
    bvn,
    national_id_type,
    national_id_number,
    additional_documents: additionalDocsJson,
  } = body;

  // Validate BVN if provided
  if (bvn && !validateBVNFormat(bvn)) {
    throw new ErrorClass("Invalid BVN format. BVN must be 11 digits", 400);
  }

  // Get or create KYC record
  let kyc = await TutorKyc.findOne({
    where: {
      tutor_id: tutorId,
    },
  });

  const isUpdate = !!kyc;

  if (!kyc) {
    kyc = await TutorKyc.create({
      tutor_id: tutorId,
      status: "pending",
    });
  }

  // Handle BVN verification if provided
  let bvnVerificationResult = null;
  if (bvn) {
    try {
      bvnVerificationResult = await verifyBVN(bvn);
      
      if (bvnVerificationResult.verified) {
        await kyc.update({
          bvn: bvn,
          bvn_verified: true,
          bvn_verification_date: new Date(),
          bvn_verification_reference: bvnVerificationResult.reference || null,
          bvn_verification_response: bvnVerificationResult.raw_response || null,
          first_name: bvnVerificationResult.first_name || null,
          last_name: bvnVerificationResult.last_name || null,
          date_of_birth: bvnVerificationResult.date_of_birth || null,
          phone_number: bvnVerificationResult.phone_number || null,
        });
      } else {
        // BVN verification failed or requires manual review
        await kyc.update({
          bvn: bvn,
          bvn_verified: false,
          bvn_verification_response: bvnVerificationResult.raw_response || null,
        });
      }
    } catch (error) {
      console.error("BVN verification error:", error);
      // Continue with KYC submission even if BVN verification fails
      await kyc.update({
        bvn: bvn,
        bvn_verified: false,
      });
    }
  }

  // Handle document uploads
  const bucket = process.env.TUTOR_DOCUMENTS_BUCKET || "tutor-documents";
  
  // Check if bucket exists, create if it doesn't
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (!listError) {
      const bucketExists = buckets?.some((b) => b.name === bucket);
      if (!bucketExists) {
        // Try to create the bucket
        const { error: createError } = await supabase.storage.createBucket(bucket, {
          public: false, // Private bucket for sensitive documents
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'],
        });
        if (createError) {
          console.error(`Failed to create bucket "${bucket}":`, createError.message);
          throw new ErrorClass(
            `Storage bucket "${bucket}" does not exist. Please create it in Supabase Storage settings. Error: ${createError.message}`,
            500
          );
        } else {
          console.log(`✅ Created bucket "${bucket}"`);
        }
      }
    }
  } catch (error) {
    if (error instanceof ErrorClass) {
      throw error;
    }
    // If bucket check fails, continue and let upload error handle it
    console.warn("Could not verify bucket existence:", error.message);
  }
  
  const uploadPromises = [];

  // National ID upload (multer fields returns arrays)
  if (req.files && req.files.national_id && req.files.national_id.length > 0) {
    const file = req.files.national_id[0];
    const fileExt = file.originalname.split(".").pop().toLowerCase();
    const fileName = `kyc/${tutorId}/national_id_${Date.now()}.${fileExt}`;

    uploadPromises.push(
      supabase.storage
        .from(bucket)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        })
        .then(async ({ data, error }) => {
          if (error) {
            if (error.message?.includes("Bucket not found") || error.message?.includes("not found")) {
              throw new ErrorClass(
                `Storage bucket "${bucket}" does not exist. Please create a bucket named "${bucket}" in your Supabase Storage settings.`,
                500
              );
            }
            throw new ErrorClass(`National ID upload failed: ${error.message}`, 500);
          }
          
          const { data: signedUrlData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(fileName, 31536000);
          
          return {
            type: "national_id",
            url: signedUrlData?.signedUrl || null,
          };
        })
    );
  }

  // Proof of address upload
  if (req.files && req.files.proof_of_address && req.files.proof_of_address.length > 0) {
    const file = req.files.proof_of_address[0];
    const fileExt = file.originalname.split(".").pop().toLowerCase();
    const fileName = `kyc/${tutorId}/proof_of_address_${Date.now()}.${fileExt}`;

    uploadPromises.push(
      supabase.storage
        .from(bucket)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        })
        .then(async ({ data, error }) => {
          if (error) {
            if (error.message?.includes("Bucket not found") || error.message?.includes("not found")) {
              throw new ErrorClass(
                `Storage bucket "${bucket}" does not exist. Please create a bucket named "${bucket}" in your Supabase Storage settings.`,
                500
              );
            }
            throw new ErrorClass(`Proof of address upload failed: ${error.message}`, 500);
          }
          
          const { data: signedUrlData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(fileName, 31536000);
          
          return {
            type: "proof_of_address",
            url: signedUrlData?.signedUrl || null,
          };
        })
    );
  }

  // Passport photo upload
  if (req.files && req.files.passport_photo && req.files.passport_photo.length > 0) {
    const file = req.files.passport_photo[0];
    const fileExt = file.originalname.split(".").pop().toLowerCase();
    const fileName = `kyc/${tutorId}/passport_photo_${Date.now()}.${fileExt}`;

    uploadPromises.push(
      supabase.storage
        .from(bucket)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        })
        .then(async ({ data, error }) => {
          if (error) {
            if (error.message?.includes("Bucket not found") || error.message?.includes("not found")) {
              throw new ErrorClass(
                `Storage bucket "${bucket}" does not exist. Please create a bucket named "${bucket}" in your Supabase Storage settings.`,
                500
              );
            }
            throw new ErrorClass(`Passport photo upload failed: ${error.message}`, 500);
          }
          
          const { data: signedUrlData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(fileName, 31536000);
          
          return {
            type: "passport_photo",
            url: signedUrlData?.signedUrl || null,
          };
        })
    );
  }

  // Wait for all uploads to complete
  const uploadResults = await Promise.all(uploadPromises);

  // Update KYC record with document URLs
  const updateData = {
    national_id_type: national_id_type || null,
    national_id_number: national_id_number || null,
    status: "pending", // Reset to pending when updated
    submitted_at: new Date(),
  };

  // Set document URLs from upload results
  uploadResults.forEach((result) => {
    if (result.type === "national_id") {
      updateData.national_id_url = result.url;
    } else if (result.type === "proof_of_address") {
      updateData.proof_of_address_url = result.url;
    } else if (result.type === "passport_photo") {
      updateData.passport_photo_url = result.url;
    }
  });

  // Handle additional documents if provided
  if (additionalDocsJson) {
    try {
      const additionalDocs = typeof additionalDocsJson === "string" 
        ? JSON.parse(additionalDocsJson) 
        : additionalDocsJson;
      updateData.additional_documents = additionalDocs;
    } catch (error) {
      console.error("Error parsing additional documents:", error);
    }
  }

  await kyc.update(updateData);

  res.status(isUpdate ? 200 : 201).json({
    success: true,
    message: isUpdate ? "KYC information updated successfully" : "KYC submitted successfully",
    data: {
      kyc: {
        id: kyc.id,
        status: kyc.status,
        bvn_verified: kyc.bvn_verified,
        submitted_at: kyc.submitted_at,
      },
      bvn_verification: bvnVerificationResult
        ? {
            verified: bvnVerificationResult.verified,
            requires_manual_verification: bvnVerificationResult.requires_manual_verification,
            message: bvnVerificationResult.message || null,
          }
        : null,
    },
  });
});
