import multer from "multer";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
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

export const uploadProfileImageMiddleware = uploadProfileImage.single(
  "profile_image"
);

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

  // Get public URL
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath)
    .data.publicUrl;

  // Update student record
  await student.update({ profile_image: publicUrl });

  res.status(200).json({
    success: true,
    message: "Profile image uploaded successfully",
    data: {
      profile_image_url: publicUrl,
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

  // Get public URL
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath)
    .data.publicUrl;

  // Update student record with document URL
  const updateData = { [document_type]: publicUrl };
  await student.update(updateData);

  res.status(200).json({
    success: true,
    message: "Document uploaded successfully",
    data: {
      document_type,
      file_url: publicUrl,
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

  res.status(200).json({
    success: true,
    message: "KYC documents retrieved successfully",
    data: {
      profile_image: student.profile_image || null,
      documents: {
        birth_certificate: student.birth_certificate || null,
        ref_letter: student.ref_letter || null,
        valid_id: student.valid_id || null,
        resume_cv: student.resume_cv || null,
        certificate_file: student.certificate_file || null,
        other_file: student.other_file || null,
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

