/**
 * Next of Kin Controller
 * Handles CRUD operations for tutor next of kin information
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TutorNextOfKin } from "../../models/marketplace/tutorNextOfKin.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { supabase } from "../../utils/supabase.js";

/**
 * Get next of kin information for current tutor
 * GET /api/marketplace/next-of-kin
 */
export const getNextOfKin = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const tutorType = req.tutor?.tutorType;

  if (!tutorId || !tutorType) {
    throw new ErrorClass("Tutor information not found", 401);
  }

  const nextOfKin = await TutorNextOfKin.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!nextOfKin) {
    return res.status(200).json({
      success: true,
      message: "No next of kin information found",
      data: {
        next_of_kin: null,
      },
    });
  }

  res.status(200).json({
    success: true,
    message: "Next of kin information retrieved successfully",
    data: {
      next_of_kin: nextOfKin,
    },
  });
});

/**
 * Create or update next of kin information
 * POST /api/marketplace/next-of-kin
 * PUT /api/marketplace/next-of-kin
 */
export const upsertNextOfKin = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const tutorType = req.tutor?.tutorType;

  if (!tutorId || !tutorType) {
    throw new ErrorClass("Tutor information not found", 401);
  }

  const {
    full_name,
    relationship,
    email,
    phone_number,
    address,
    identification_type,
    identification_number,
    bank_account_name,
    bank_account_number,
    bank_name,
    bank_code,
    notes,
  } = req.body;

  // Validate required fields
  if (!full_name || !relationship || !phone_number) {
    throw new ErrorClass("Full name, relationship, and phone number are required", 400);
  }

  // Validate tutor exists
  let tutorExists = false;
  if (tutorType === "sole_tutor") {
    const tutor = await SoleTutor.findByPk(tutorId);
    tutorExists = !!tutor;
  } else if (tutorType === "organization") {
    const tutor = await Organization.findByPk(tutorId);
    tutorExists = !!tutor;
  }

  if (!tutorExists) {
    throw new ErrorClass("Tutor not found", 404);
  }

  // Handle identification document upload if provided
  let identificationDocumentUrl = null;
  if (req.files && req.files.identification_document) {
    const file = req.files.identification_document;
    const fileExtension = file.name.split(".").pop().toLowerCase();
    const allowedExtensions = ["pdf", "jpg", "jpeg", "png"];

    if (!allowedExtensions.includes(fileExtension)) {
      throw new ErrorClass("Identification document must be PDF, JPG, JPEG, or PNG", 400);
    }

    const bucket = process.env.TUTOR_DOCUMENTS_BUCKET || "tutor-documents";
    const fileName = `next-of-kin/${tutorId}-${tutorType}-${Date.now()}.${fileExtension}`;

    // Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file.buffer || file.data, {
        contentType: file.mimetype || `application/${fileExtension}`,
        upsert: false,
      });

    if (uploadError) {
      throw new ErrorClass(`Document upload failed: ${uploadError.message}`, 500);
    }

    // Generate signed URL for private bucket (expires in 1 year)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(fileName, 31536000); // 1 year expiration

    if (urlError) {
      // Fallback to public URL if signed URL fails (for public buckets)
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      identificationDocumentUrl = urlData.publicUrl;
    } else {
      // Use signed URL for private bucket
      identificationDocumentUrl = signedUrlData.signedUrl;
    }
  }

  // Check if next of kin already exists
  const existing = await TutorNextOfKin.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  let nextOfKin;
  if (existing) {
    // Update existing
    const updateData = {
      full_name,
      relationship,
      email: email || null,
      phone_number,
      address: address || null,
      identification_type: identification_type || null,
      identification_number: identification_number || null,
      bank_account_name: bank_account_name || null,
      bank_account_number: bank_account_number || null,
      bank_name: bank_name || null,
      bank_code: bank_code || null,
      notes: notes || null,
      status: "pending_verification", // Reset to pending when updated
      is_verified: false,
      verified_at: null,
      verified_by: null,
    };

    if (identificationDocumentUrl) {
      updateData.identification_document_url = identificationDocumentUrl;
    }

    await existing.update(updateData);
    nextOfKin = existing;
  } else {
    // Create new
    nextOfKin = await TutorNextOfKin.create({
      tutor_id: tutorId,
      tutor_type: tutorType,
      full_name,
      relationship,
      email: email || null,
      phone_number,
      address: address || null,
      identification_type: identification_type || null,
      identification_number: identification_number || null,
      identification_document_url: identificationDocumentUrl,
      bank_account_name: bank_account_name || null,
      bank_account_number: bank_account_number || null,
      bank_name: bank_name || null,
      bank_code: bank_code || null,
      notes: notes || null,
      status: "pending_verification",
      is_verified: false,
    });
  }

  res.status(existing ? 200 : 201).json({
    success: true,
    message: existing ? "Next of kin information updated successfully" : "Next of kin information created successfully",
    data: {
      next_of_kin: nextOfKin,
    },
  });
});

/**
 * Delete next of kin information
 * DELETE /api/marketplace/next-of-kin
 */
export const deleteNextOfKin = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const tutorType = req.tutor?.tutorType;

  if (!tutorId || !tutorType) {
    throw new ErrorClass("Tutor information not found", 401);
  }

  const nextOfKin = await TutorNextOfKin.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!nextOfKin) {
    throw new ErrorClass("Next of kin information not found", 404);
  }

  // Check if there are any pending or processing fund transfers
  const { FundTransfer } = await import("../../models/marketplace/fundTransfer.js");
  const activeTransfers = await FundTransfer.count({
    where: {
      next_of_kin_id: nextOfKin.id,
      status: {
        [Op.in]: ["pending", "processing"],
      },
    },
  });

  if (activeTransfers > 0) {
    throw new ErrorClass("Cannot delete next of kin with active fund transfers", 400);
  }

  await nextOfKin.destroy();

  res.status(200).json({
    success: true,
    message: "Next of kin information deleted successfully",
  });
});
