import { Op } from "sequelize";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { Students } from "../../../models/auth/student.js";
import { StudentDocumentApproval } from "../../../models/kyc/studentDocumentApproval.js";
import { Program } from "../../../models/program/program.js";
import { supabase } from "../../../utils/supabase.js";

/**
 * Get student KYC documents (Admin)
 * GET /api/admin/students/:id/kyc
 */
export const getStudentKycDocuments = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const userType = req.user?.userType;

  // Only admin can access
  if (userType !== "admin") {
    throw new ErrorClass("Only admins can view student KYC documents", 403);
  }

  // Get student with KYC documents
  const student = await Students.findByPk(id, {
    attributes: [
      "id",
      "fname",
      "mname",
      "lname",
      "email",
      "matric_number",
      "admin_status",
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
    where: { student_id: id },
    attributes: ["document_type", "status", "rejection_reason", "reviewed_at", "reviewed_by"],
  });

  // Create a map of document_type -> approval status
  const approvalMap = {};
  approvals.forEach((approval) => {
    approvalMap[approval.document_type] = {
      status: approval.status,
      rejection_reason: approval.rejection_reason,
      reviewed_at: approval.reviewed_at,
      reviewed_by: approval.reviewed_by,
    };
  });

  // Helper function to get approval status
  const getApprovalStatus = (docType) => {
    return approvalMap[docType] || {
      status: student[docType] ? "pending" : null,
      rejection_reason: null,
      reviewed_at: null,
      reviewed_by: null,
    };
  };

  res.status(200).json({
    success: true,
    message: "Student KYC documents retrieved successfully",
    data: {
      student: {
        id: student.id,
        name: `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim(),
        email: student.email,
        matric_number: student.matric_number,
        admin_status: student.admin_status,
      },
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
 * Get signed URL for student document (Admin)
 * POST /api/admin/students/:id/kyc/signed-url
 * For private buckets - generates a signed URL for admin to view document
 */
export const getStudentDocumentSignedUrl = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { document_type, file_url } = req.body;
  const userType = req.user?.userType;

  // Only admin can access
  if (userType !== "admin") {
    throw new ErrorClass("Only admins can access signed URLs", 403);
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

  // Verify student exists
  const student = await Students.findByPk(id);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
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
      student_id: id,
      document_type,
      signed_url: signedUrlData.signedUrl,
      expires_in: 3600, // seconds
    },
  });
});

/**
 * Get all students with KYC document status (Admin)
 * GET /api/admin/students/kyc/status
 * Returns list of students with their KYC document upload status
 */
export const getAllStudentsKycStatus = TryCatchFunction(async (req, res) => {
  const userType = req.user?.userType;
  const { page = 1, limit = 20, status, search } = req.query;

  // Only admin can access
  if (userType !== "admin") {
    throw new ErrorClass("Only admins can view KYC status", 403);
  }

  // Build where clause
  const where = {};
  if (status) {
    where.admin_status = status;
  }
  if (search) {
    where[Op.or] = [
      { fname: { [Op.iLike]: `%${search}%` } },
      { lname: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { matric_number: { [Op.iLike]: `%${search}%` } },
    ];
  }

  // Get students with pagination
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows: students } = await Students.findAndCountAll({
    where,
    attributes: [
      "id",
      "fname",
      "mname",
      "lname",
      "email",
      "matric_number",
      "admin_status",
      "profile_image",
      "birth_certificate",
      "ref_letter",
      "valid_id",
      "resume_cv",
      "certificate_file",
      "other_file",
    ],
    limit: parseInt(limit),
    offset,
    order: [["id", "DESC"]],
  });

  // Calculate KYC status for each student
  const studentsWithKycStatus = students.map((student) => {
    const documents = [
      student.profile_image,
      student.birth_certificate,
      student.ref_letter,
      student.valid_id,
      student.resume_cv,
      student.certificate_file,
      student.other_file,
    ];

    const uploadedCount = documents.filter(Boolean).length;
    const totalDocuments = 7; // profile + 6 document types

    return {
      id: student.id,
      name: `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim(),
      email: student.email,
      matric_number: student.matric_number,
      admin_status: student.admin_status,
      kyc_status: {
        uploaded: uploadedCount,
        total: totalDocuments,
        percentage: Math.round((uploadedCount / totalDocuments) * 100),
        completed: uploadedCount === totalDocuments,
        documents: {
          profile_image: !!student.profile_image,
          birth_certificate: !!student.birth_certificate,
          ref_letter: !!student.ref_letter,
          valid_id: !!student.valid_id,
          resume_cv: !!student.resume_cv,
          certificate_file: !!student.certificate_file,
          other_file: !!student.other_file,
        },
      },
    };
  });

  res.status(200).json({
    success: true,
    message: "Students KYC status retrieved successfully",
    data: {
      students: studentsWithKycStatus,
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
 * Approve student document
 * PUT /api/admin/students/:id/kyc/documents/:document_type/approve
 */
export const approveStudentDocument = TryCatchFunction(async (req, res) => {
  const { id, document_type } = req.params;
  const adminId = Number(req.user?.id);
  const userType = req.user?.userType;

  // Only admin can access
  if (userType !== "admin") {
    throw new ErrorClass("Only admins can approve documents", 403);
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

  if (!allowedDocumentTypes.includes(document_type)) {
    throw new ErrorClass(
      `Invalid document type. Allowed types: ${allowedDocumentTypes.join(", ")}`,
      400
    );
  }

  // Verify student exists
  const student = await Students.findByPk(id);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Find or create approval record
  const [approval, created] = await StudentDocumentApproval.findOrCreate({
    where: {
      student_id: id,
      document_type,
    },
    defaults: {
      student_id: id,
      document_type,
      file_url: student[document_type] || null,
      status: "pending",
    },
  });

  // Update approval status
  await approval.update({
    status: "approved",
    rejection_reason: null,
    reviewed_by: adminId,
    reviewed_at: new Date(),
  });

  res.status(200).json({
    success: true,
    message: "Document approved successfully",
    data: {
      student_id: id,
      document_type,
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: approval.reviewed_at,
    },
  });
});

/**
 * Reject student document
 * PUT /api/admin/students/:id/kyc/documents/:document_type/reject
 */
export const rejectStudentDocument = TryCatchFunction(async (req, res) => {
  const { id, document_type } = req.params;
  const { rejection_reason } = req.body;
  const adminId = Number(req.user?.id);
  const userType = req.user?.userType;

  // Only admin can access
  if (userType !== "admin") {
    throw new ErrorClass("Only admins can reject documents", 403);
  }

  // Validate rejection reason
  if (!rejection_reason || rejection_reason.trim().length === 0) {
    throw new ErrorClass("Rejection reason is required", 400);
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

  if (!allowedDocumentTypes.includes(document_type)) {
    throw new ErrorClass(
      `Invalid document type. Allowed types: ${allowedDocumentTypes.join(", ")}`,
      400
    );
  }

  // Verify student exists
  const student = await Students.findByPk(id);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Find or create approval record
  const [approval, created] = await StudentDocumentApproval.findOrCreate({
    where: {
      student_id: id,
      document_type,
    },
    defaults: {
      student_id: id,
      document_type,
      file_url: student[document_type] || null,
      status: "pending",
    },
  });

  // Update approval status
  await approval.update({
    status: "rejected",
    rejection_reason: rejection_reason.trim(),
    reviewed_by: adminId,
    reviewed_at: new Date(),
  });

  res.status(200).json({
    success: true,
    message: "Document rejected successfully",
    data: {
      student_id: id,
      document_type,
      status: "rejected",
      rejection_reason: rejection_reason.trim(),
      reviewed_by: adminId,
      reviewed_at: approval.reviewed_at,
    },
  });
});

/**
 * Get pending documents for review (Admin) - Grouped by student
 * GET /api/admin/students/kyc/pending
 * Returns students who have at least one pending document, with all their documents grouped together
 */
export const getPendingDocuments = TryCatchFunction(async (req, res) => {
  const userType = req.user?.userType;
  const { page = 1, limit = 20, search } = req.query;

  // Only admin can access
  if (userType !== "admin") {
    throw new ErrorClass("Only admins can view pending documents", 403);
  }

  // Get all students who have at least one pending document
  const pendingApprovals = await StudentDocumentApproval.findAll({
    where: {
      status: "pending",
    },
    attributes: ["student_id"],
    group: ["student_id"],
    raw: true,
  });

  const studentIdsWithPending = pendingApprovals.map((a) => a.student_id);

  if (studentIdsWithPending.length === 0) {
    return res.status(200).json({
      success: true,
      message: "No pending documents found",
      data: {
        students: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
        },
      },
    });
  }

  // Build where clause for students
  const studentWhere = {
    id: { [Op.in]: studentIdsWithPending },
  };

  if (search) {
    studentWhere[Op.or] = [
      { fname: { [Op.iLike]: `%${search}%` } },
      { lname: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { matric_number: { [Op.iLike]: `%${search}%` } },
    ];
  }

  // Get students with pagination (including program)
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows: students } = await Students.findAndCountAll({
    where: studentWhere,
    attributes: [
      "id",
      "fname",
      "mname",
      "lname",
      "email",
      "matric_number",
      "admin_status",
      "program_id",
      "profile_image",
      "birth_certificate",
      "ref_letter",
      "valid_id",
      "resume_cv",
      "certificate_file",
      "other_file",
    ],
    include: [
      {
        model: Program,
        as: "program",
        attributes: ["id", "title", "description"],
        required: false,
      },
    ],
    limit: parseInt(limit),
    offset,
    order: [["id", "DESC"]],
  });

  // Get all approval records for these students
  const studentIds = students.map((s) => s.id);
  const allApprovals = await StudentDocumentApproval.findAll({
    where: {
      student_id: { [Op.in]: studentIds },
    },
    attributes: ["student_id", "document_type", "status", "rejection_reason", "reviewed_at", "file_url"],
  });

  // Group approvals by student_id
  const approvalsByStudent = {};
  allApprovals.forEach((approval) => {
    if (!approvalsByStudent[approval.student_id]) {
      approvalsByStudent[approval.student_id] = [];
    }
    approvalsByStudent[approval.student_id].push(approval);
  });

  // Build response with all documents grouped by student
  const studentsWithDocuments = students.map((student) => {
    const approvals = approvalsByStudent[student.id] || [];
    const approvalMap = {};
    approvals.forEach((approval) => {
      approvalMap[approval.document_type] = {
        status: approval.status,
        rejection_reason: approval.rejection_reason,
        reviewed_at: approval.reviewed_at,
        file_url: approval.file_url,
      };
    });

    // Helper to get document info
    const getDocumentInfo = (docType, fieldName) => {
      const url = student[fieldName] || null;
      const approval = approvalMap[docType];
      
      if (!url) {
        return null;
      }

      return {
        url,
        status: approval?.status || "pending",
        rejection_reason: approval?.rejection_reason || null,
        reviewed_at: approval?.reviewed_at || null,
      };
    };

    const documents = {
      profile_image: getDocumentInfo("profile_image", "profile_image"),
      birth_certificate: getDocumentInfo("birth_certificate", "birth_certificate"),
      ref_letter: getDocumentInfo("ref_letter", "ref_letter"),
      valid_id: getDocumentInfo("valid_id", "valid_id"),
      resume_cv: getDocumentInfo("resume_cv", "resume_cv"),
      certificate_file: getDocumentInfo("certificate_file", "certificate_file"),
      other_file: getDocumentInfo("other_file", "other_file"),
    };

    // Count statuses
    const statusCounts = { pending: 0, approved: 0, rejected: 0 };
    Object.values(documents).forEach((doc) => {
      if (doc && doc.status) {
        statusCounts[doc.status] = (statusCounts[doc.status] || 0) + 1;
      }
    });

    return {
      student_id: student.id,
      name: `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim(),
      email: student.email,
      matric_number: student.matric_number,
      admin_status: student.admin_status,
      program: student.program
        ? {
            id: student.program.id,
            title: student.program.title,
            description: student.program.description,
          }
        : null,
      documents,
      summary: {
        pending: statusCounts.pending,
        approved: statusCounts.approved,
        rejected: statusCounts.rejected,
        total: statusCounts.pending + statusCounts.approved + statusCounts.rejected,
      },
    };
  });

  res.status(200).json({
    success: true,
    message: "Pending documents retrieved successfully (grouped by student)",
    data: {
      students: studentsWithDocuments,
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
 * Get all students with fully approved KYC documents
 * GET /api/admin/students/kyc/approved
 * Returns students who have ALL their uploaded documents approved (no pending or rejected)
 */
export const getFullyApprovedStudents = TryCatchFunction(async (req, res) => {
  const userType = req.user?.userType;
  const { page = 1, limit = 20, search } = req.query;

  // Only admin can access
  if (userType !== "admin") {
    throw new ErrorClass("Only admins can view approved students", 403);
  }

  // Get all students who have uploaded at least one document
  const studentsWithDocuments = await Students.findAll({
    where: {
      [Op.or]: [
        { profile_image: { [Op.ne]: null } },
        { birth_certificate: { [Op.ne]: null } },
        { ref_letter: { [Op.ne]: null } },
        { valid_id: { [Op.ne]: null } },
        { resume_cv: { [Op.ne]: null } },
        { certificate_file: { [Op.ne]: null } },
        { other_file: { [Op.ne]: null } },
      ],
    },
    attributes: [
      "id",
      "profile_image",
      "birth_certificate",
      "ref_letter",
      "valid_id",
      "resume_cv",
      "certificate_file",
      "other_file",
    ],
  });

  const studentIds = studentsWithDocuments.map((s) => s.id);

  if (studentIds.length === 0) {
    return res.status(200).json({
      success: true,
      message: "No students with documents found",
      data: {
        students: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
        },
      },
    });
  }

  // Get all approval records for these students
  const allApprovals = await StudentDocumentApproval.findAll({
    where: {
      student_id: { [Op.in]: studentIds },
    },
    attributes: ["student_id", "document_type", "status"],
  });

  // Group approvals by student_id
  const approvalsByStudent = {};
  allApprovals.forEach((approval) => {
    if (!approvalsByStudent[approval.student_id]) {
      approvalsByStudent[approval.student_id] = [];
    }
    approvalsByStudent[approval.student_id].push(approval);
  });

  // Find students who have ALL their documents approved (no pending or rejected)
  const fullyApprovedStudentIds = [];
  
  for (const student of studentsWithDocuments) {
    const studentId = student.id;

    const uploadedDocuments = [
      { type: "profile_image", url: student.profile_image },
      { type: "birth_certificate", url: student.birth_certificate },
      { type: "ref_letter", url: student.ref_letter },
      { type: "valid_id", url: student.valid_id },
      { type: "resume_cv", url: student.resume_cv },
      { type: "certificate_file", url: student.certificate_file },
      { type: "other_file", url: student.other_file },
    ].filter((doc) => doc.url); // Only documents that were uploaded

    if (uploadedDocuments.length === 0) continue;

    const approvals = approvalsByStudent[studentId] || [];
    const approvalMap = {};
    approvals.forEach((approval) => {
      approvalMap[approval.document_type] = approval.status;
    });

    // Check if all uploaded documents are approved
    const allApproved = uploadedDocuments.every((doc) => {
      const status = approvalMap[doc.type];
      return status === "approved";
    });

    // Also check that there are no pending or rejected documents
    const hasPendingOrRejected = approvals.some(
      (approval) => approval.status === "pending" || approval.status === "rejected"
    );

    if (allApproved && !hasPendingOrRejected) {
      fullyApprovedStudentIds.push(studentId);
    }
  }

  if (fullyApprovedStudentIds.length === 0) {
    return res.status(200).json({
      success: true,
      message: "No fully approved students found",
      data: {
        students: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
        },
      },
    });
  }

  // Build where clause
  const where = {
    id: { [Op.in]: fullyApprovedStudentIds },
  };

  if (search) {
    where[Op.or] = [
      { fname: { [Op.iLike]: `%${search}%` } },
      { lname: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { matric_number: { [Op.iLike]: `%${search}%` } },
    ];
  }

  // Get students with pagination (including program)
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows: students } = await Students.findAndCountAll({
    where,
    attributes: [
      "id",
      "fname",
      "mname",
      "lname",
      "email",
      "matric_number",
      "admin_status",
      "program_id",
    ],
    include: [
      {
        model: Program,
        as: "program",
        attributes: ["id", "title", "description"],
        required: false,
      },
    ],
    limit: parseInt(limit),
    offset,
    order: [["id", "DESC"]],
  });

  // Get approval info to find when they were fully approved
  const studentIdsForApproval = students.map((s) => s.id);
  const studentApprovals = await StudentDocumentApproval.findAll({
    where: {
      student_id: { [Op.in]: studentIdsForApproval },
      status: "approved",
    },
    attributes: ["student_id", "reviewed_at"],
    order: [["reviewed_at", "DESC"]],
  });

  // Find the latest approval date for each student (when they were fully approved)
  const latestApprovalByStudent = {};
  studentApprovals.forEach((approval) => {
    if (
      !latestApprovalByStudent[approval.student_id] ||
      new Date(approval.reviewed_at) > new Date(latestApprovalByStudent[approval.student_id])
    ) {
      latestApprovalByStudent[approval.student_id] = approval.reviewed_at;
    }
  });

  // Get full student data for document counting
  const studentsWithFullData = await Students.findAll({
    where: {
      id: { [Op.in]: studentIdsForApproval },
    },
    attributes: [
      "id",
      "profile_image",
      "birth_certificate",
      "ref_letter",
      "valid_id",
      "resume_cv",
      "certificate_file",
      "other_file",
    ],
  });

  // Count documents for each student
  const documentCounts = {};
  studentsWithFullData.forEach((student) => {
    const count = [
      student.profile_image,
      student.birth_certificate,
      student.ref_letter,
      student.valid_id,
      student.resume_cv,
      student.certificate_file,
      student.other_file,
    ].filter(Boolean).length;

    documentCounts[student.id] = count;
  });

  const approvedStudents = students.map((student) => ({
    student_id: student.id,
    name: `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim(),
    email: student.email,
    matric_number: student.matric_number,
    admin_status: student.admin_status,
    program: student.program
      ? {
          id: student.program.id,
          title: student.program.title,
          description: student.program.description,
        }
      : null,
    approved_at: latestApprovalByStudent[student.id] || null,
    documents_count: documentCounts[student.id] || 0,
  }));

  res.status(200).json({
    success: true,
    message: "Fully approved students retrieved successfully",
    data: {
      students: approvedStudents,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

