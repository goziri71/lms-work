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

  const {
    bvn,
    national_id_type,
    national_id_number,
    additional_documents: additionalDocsJson,
  } = req.body;

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
  const uploadPromises = [];

  // National ID upload
  if (req.files && req.files.national_id) {
    const file = req.files.national_id;
    const fileExt = file.name.split(".").pop().toLowerCase();
    const fileName = `kyc/${tutorId}/national_id_${Date.now()}.${fileExt}`;

    uploadPromises.push(
      supabase.storage
        .from(bucket)
        .upload(fileName, file.buffer || file.data, {
          contentType: file.mimetype,
          upsert: false,
        })
        .then(async ({ data, error }) => {
          if (error) throw new ErrorClass(`National ID upload failed: ${error.message}`, 500);
          
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
  if (req.files && req.files.proof_of_address) {
    const file = req.files.proof_of_address;
    const fileExt = file.name.split(".").pop().toLowerCase();
    const fileName = `kyc/${tutorId}/proof_of_address_${Date.now()}.${fileExt}`;

    uploadPromises.push(
      supabase.storage
        .from(bucket)
        .upload(fileName, file.buffer || file.data, {
          contentType: file.mimetype,
          upsert: false,
        })
        .then(async ({ data, error }) => {
          if (error) throw new ErrorClass(`Proof of address upload failed: ${error.message}`, 500);
          
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
  if (req.files && req.files.passport_photo) {
    const file = req.files.passport_photo;
    const fileExt = file.name.split(".").pop().toLowerCase();
    const fileName = `kyc/${tutorId}/passport_photo_${Date.now()}.${fileExt}`;

    uploadPromises.push(
      supabase.storage
        .from(bucket)
        .upload(fileName, file.buffer || file.data, {
          contentType: file.mimetype,
          upsert: false,
        })
        .then(async ({ data, error }) => {
          if (error) throw new ErrorClass(`Passport photo upload failed: ${error.message}`, 500);
          
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
