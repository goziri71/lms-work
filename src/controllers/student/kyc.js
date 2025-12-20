import multer from "multer";
import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { StudentDocumentApproval } from "../../models/kyc/studentDocumentApproval.js";
import { supabase } from "../../utils/supabase.js";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ErrorClass(
          "Invalid file type. Only JPEG, PNG, and PDF files are allowed",
          400
        ),
        false
      );
    }
  },
});

// Middleware for single file upload
export const uploadFileMiddleware = upload.single("file");

// Middleware for profile image upload (images only)
const uploadProfileImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for profile images
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ErrorClass(
          "Invalid file type. Only JPEG and PNG images are allowed for profile picture",
          400
        ),
        false
      );
    }
  },
});

// Accept any field name for profile image (more flexible)
export const uploadProfileImageMiddleware = (req, res, next) => {
  // Use .any() to accept any field name, then validate it's an image
  const middleware = uploadProfileImage.any();
  
  middleware(req, res, (err) => {
    if (err) {
      return next(err);
    }
    
    // Check if any file was uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "No file uploaded. Please upload a profile image file.",
      });
    }
    
    // Multer .any() returns files in req.files array, but we expect single file
    // Take the first file and put it in req.file for consistency
    if (req.files.length > 0) {
      req.file = req.files[0];
    }
    
    // Validate it's an image
    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Invalid file type. Only JPEG and PNG images are allowed for profile picture",
      });
    }
    
    next();
  });
};

/**
 * Upload profile image
 * POST /api/student/kyc/profile-image
 */
export const uploadProfileImageHandler = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can upload profile images", 403);
  }

  if (!req.file) {
    throw new ErrorClass("Profile image file is required", 400);
  }

  // Get student
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Upload to Supabase
  const bucket = process.env.STUDENT_DOCUMENTS_BUCKET || "student-documents";
  const ext = req.file.mimetype?.split("/")[1] || "jpg";
  const objectPath = `students/${studentId}/profile/profile_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true,
    });

  if (error) {
    throw new ErrorClass(`Upload failed: ${error.message}`, 500);
  }

  // Generate signed URL for private bucket (expires in 1 year)
  // For private buckets, signed URLs are required; for public buckets, this still works
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 31536000); // 1 year expiration

  if (urlError) {
    // Fallback to public URL if signed URL fails (for public buckets)
    const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath)
      .data.publicUrl;
    await student.update({ profile_image: publicUrl });
    
    res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      data: {
        profile_image_url: publicUrl,
      },
    });
    return;
  }

  // Use signed URL for private bucket
  const fileUrl = signedUrlData.signedUrl;
  await student.update({ profile_image: fileUrl });

  // Create or update approval record with "pending" status
  await StudentDocumentApproval.upsert({
    student_id: studentId,
    document_type: "profile_image",
    file_url: fileUrl,
    status: "pending",
    rejection_reason: null,
    reviewed_by: null,
    reviewed_at: null,
  }, {
    conflictFields: ["student_id", "document_type"],
  });

  res.status(200).json({
    success: true,
    message: "Profile image uploaded successfully. Pending admin approval.",
    data: {
      profile_image_url: fileUrl,
      status: "pending",
    },
  });
});

/**
 * Upload KYC document
 * POST /api/student/kyc/documents
 * Body: document_type (birth_certificate, ref_letter, valid_id, resume_cv, certificate_file, other_file)
 */
export const uploadKycDocument = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const { document_type } = req.body;

  if (userType !== "student") {
    throw new ErrorClass("Only students can upload documents", 403);
  }

  if (!req.file) {
    throw new ErrorClass("Document file is required", 400);
  }

  // Validate document type
  const allowedDocumentTypes = [
    "birth_certificate",
    "ref_letter",
    "valid_id",
    "resume_cv",
    "certificate_file",
    "other_file",
  ];

  if (!document_type || !allowedDocumentTypes.includes(document_type)) {
    throw new ErrorClass(
      `Invalid document type. Allowed types: ${allowedDocumentTypes.join(", ")}`,
      400
    );
  }

  // Get student
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Upload to Supabase
  const bucket = process.env.STUDENT_DOCUMENTS_BUCKET || "student-documents";
  const ext = req.file.mimetype?.split("/")[1] || "pdf";
  const objectPath = `students/${studentId}/documents/${document_type}/${document_type}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true,
    });

  if (error) {
    throw new ErrorClass(`Upload failed: ${error.message}`, 500);
  }

  // Generate signed URL for private bucket (expires in 1 year)
  // For private buckets, signed URLs are required; for public buckets, this still works
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 31536000); // 1 year expiration

  let fileUrl;
  if (urlError) {
    // Fallback to public URL if signed URL fails (for public buckets)
    fileUrl = supabase.storage.from(bucket).getPublicUrl(objectPath)
      .data.publicUrl;
  } else {
    // Use signed URL for private bucket
    fileUrl = signedUrlData.signedUrl;
  }

  // Update student record with document URL
  const updateData = { [document_type]: fileUrl };
  await student.update(updateData);

  // Create or update approval record with "pending" status
  await StudentDocumentApproval.upsert({
    student_id: studentId,
    document_type,
    file_url: fileUrl,
    status: "pending",
    rejection_reason: null,
    reviewed_by: null,
    reviewed_at: null,
  }, {
    conflictFields: ["student_id", "document_type"],
  });

  res.status(200).json({
    success: true,
    message: "Document uploaded successfully. Pending admin approval.",
    data: {
      document_type,
      file_url: fileUrl,
      status: "pending",
      uploaded_at: new Date().toISOString(),
    },
  });
});

/**
 * Get KYC documents status
 * GET /api/student/kyc/documents
 */
export const getKycDocuments = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can view their documents", 403);
  }

  // Get student
  const student = await Students.findByPk(studentId, {
    attributes: [
      "id",
      "profile_image",
      "birth_certificate",
      "ref_letter",
      "valid_id",
      "resume_cv",
      "certificate_file",
      "other_file",
      "school",
      "school_date",
      "school1",
      "school1_date",
      "school2",
      "school2_date",
    ],
  });

  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get approval status for all documents
  const approvals = await StudentDocumentApproval.findAll({
    where: { student_id: studentId },
    attributes: ["document_type", "status", "rejection_reason", "reviewed_at"],
  });

  // Create a map of document_type -> approval status
  const approvalMap = {};
  approvals.forEach((approval) => {
    approvalMap[approval.document_type] = {
      status: approval.status,
      rejection_reason: approval.rejection_reason,
      reviewed_at: approval.reviewed_at,
    };
  });

  // Helper function to get approval status for a document
  const getApprovalStatus = (docType) => {
    return approvalMap[docType] || {
      status: student[docType] ? "pending" : null,
      rejection_reason: null,
      reviewed_at: null,
    };
  };

  // For private buckets, URLs stored are signed URLs (valid for 1 year)
  // If URLs expire, frontend can call /api/student/kyc/documents/signed-url endpoint
  res.status(200).json({
    success: true,
    message: "KYC documents retrieved successfully",
    data: {
      profile_image: {
        url: student.profile_image || null,
        ...getApprovalStatus("profile_image"),
      },
      documents: {
        birth_certificate: {
          url: student.birth_certificate || null,
          ...getApprovalStatus("birth_certificate"),
        },
        ref_letter: {
          url: student.ref_letter || null,
          ...getApprovalStatus("ref_letter"),
        },
        valid_id: {
          url: student.valid_id || null,
          ...getApprovalStatus("valid_id"),
        },
        resume_cv: {
          url: student.resume_cv || null,
          ...getApprovalStatus("resume_cv"),
        },
        certificate_file: {
          url: student.certificate_file || null,
          ...getApprovalStatus("certificate_file"),
        },
        other_file: {
          url: student.other_file || null,
          ...getApprovalStatus("other_file"),
        },
      },
      schools: {
        school1: {
          name: student.school1 || null,
          date: student.school1_date || null,
        },
        school2: {
          name: student.school2 || null,
          date: student.school2_date || null,
        },
        general_school: {
          name: student.school || null,
          date: student.school_date || null,
        },
      },
    },
  });
});

/**
 * Get signed URL for a document (for private buckets when URLs expire)
 * POST /api/student/kyc/documents/signed-url
 */
export const getSignedUrl = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const { document_type, file_url } = req.body;

  if (userType !== "student") {
    throw new ErrorClass("Only students can access signed URLs", 403);
  }

  // Validate document type
  const allowedDocumentTypes = [
    "profile_image",
    "birth_certificate",
    "ref_letter",
    "valid_id",
    "resume_cv",
    "certificate_file",
    "other_file",
  ];

  if (!document_type || !allowedDocumentTypes.includes(document_type)) {
    throw new ErrorClass(
      `Invalid document type. Allowed types: ${allowedDocumentTypes.join(", ")}`,
      400
    );
  }

  if (!file_url) {
    throw new ErrorClass("File URL is required", 400);
  }

  // Extract file path from URL
  // URL format: https://{supabase-url}/storage/v1/object/public/{bucket}/{path}
  // or: https://{supabase-url}/storage/v1/object/sign/{bucket}/{path}?token=...
  const urlParts = file_url.split("/storage/v1/object/");
  if (urlParts.length < 2) {
    throw new ErrorClass("Invalid file URL format", 400);
  }

  const pathPart = urlParts[1].split("?")[0]; // Remove query params if any
  const pathParts = pathPart.split("/");
  const bucket = pathParts[0];
  const objectPath = pathParts.slice(1).join("/");

  // Generate new signed URL (expires in 1 hour for security)
  const { data: signedUrlData, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 3600); // 1 hour expiration

  if (error) {
    throw new ErrorClass(`Failed to generate signed URL: ${error.message}`, 500);
  }

  res.status(200).json({
    success: true,
    message: "Signed URL generated successfully",
    data: {
      document_type,
      signed_url: signedUrlData.signedUrl,
      expires_in: 3600, // seconds
    },
  });
});

/**
 * Update school information
 * PUT /api/student/kyc/schools
 */
export const updateSchoolInfo = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const { school1, school1_date, school2, school2_date, school, school_date } =
    req.body;

  if (userType !== "student") {
    throw new ErrorClass("Only students can update school information", 403);
  }

  // Get student
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Prepare update data (only include provided fields)
  const updateData = {};
  if (school1 !== undefined) updateData.school1 = school1;
  if (school1_date !== undefined) updateData.school1_date = school1_date;
  if (school2 !== undefined) updateData.school2 = school2;
  if (school2_date !== undefined) updateData.school2_date = school2_date;
  if (school !== undefined) updateData.school = school;
  if (school_date !== undefined) updateData.school_date = school_date;

  if (Object.keys(updateData).length === 0) {
    throw new ErrorClass("No school information provided to update", 400);
  }

  // Update student record
  await student.update(updateData);

  // Get updated student data
  const updatedStudent = await Students.findByPk(studentId, {
    attributes: [
      "id",
      "school",
      "school_date",
      "school1",
      "school1_date",
      "school2",
      "school2_date",
    ],
  });

  res.status(200).json({
    success: true,
    message: "School information updated successfully",
    data: {
      schools: {
        school1: {
          name: updatedStudent.school1 || null,
          date: updatedStudent.school1_date || null,
        },
        school2: {
          name: updatedStudent.school2 || null,
          date: updatedStudent.school2_date || null,
        },
        general_school: {
          name: updatedStudent.school || null,
          date: updatedStudent.school_date || null,
        },
      },
    },
  });
});

