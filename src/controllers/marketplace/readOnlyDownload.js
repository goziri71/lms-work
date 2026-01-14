/**
 * Read-Only Digital Download Controller
 * Handles read-only document viewing and progress tracking
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { DigitalDownloadPurchase } from "../../models/marketplace/digitalDownloadPurchase.js";
import { ReadSession } from "../../models/marketplace/readSession.js";
import { Students } from "../../models/auth/student.js";
import crypto from "crypto";
import { Op } from "sequelize";

/**
 * Create or get read session for a read-only document
 * POST /api/marketplace/digital-downloads/:id/read-session
 */
export const createReadSession = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can access read-only documents", 403);
  }

  const { id } = req.params;

  // Get digital download
  const download = await DigitalDownloads.findByPk(id);

  if (!download) {
    throw new ErrorClass("Digital download not found", 404);
  }

  if (!download.is_read_only) {
    throw new ErrorClass("This document is not read-only. Use the regular download endpoint.", 400);
  }

  if (download.status !== "published") {
    throw new ErrorClass("Document is not available", 404);
  }

  // Verify student has purchased access
  const purchase = await DigitalDownloadPurchase.findOne({
    where: {
      digital_download_id: id,
      student_id: studentId,
      status: "completed",
    },
  });

  if (!purchase) {
    throw new ErrorClass("You must purchase this document to read it", 403);
  }

  // Check for existing session
  let session = await ReadSession.findOne({
    where: {
      digital_download_id: id,
      student_id: studentId,
      expires_at: {
        [Op.gt]: new Date(),
      },
    },
  });

  if (session) {
    // Update last_read_at
    await session.update({ last_read_at: new Date() });

    return res.status(200).json({
      success: true,
      message: "Read session retrieved",
      data: {
        session: {
          id: session.id,
          session_token: session.session_token,
          current_page: session.current_page,
          total_pages: session.total_pages,
          progress_percentage: parseFloat(session.progress_percentage),
          expires_at: session.expires_at,
        },
        viewer_url: `/api/marketplace/digital-downloads/${id}/read?token=${session.session_token}`,
      },
    });
  }

  // Create new session
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 2); // 2-hour session

  session = await ReadSession.create({
    digital_download_id: id,
    student_id: studentId,
    current_page: 1,
    total_pages: download.pages || null,
    progress_percentage: 0.0,
    session_token: sessionToken,
    expires_at: expiresAt,
  });

  res.status(201).json({
    success: true,
    message: "Read session created",
    data: {
      session: {
        id: session.id,
        session_token: session.session_token,
        current_page: session.current_page,
        total_pages: session.total_pages,
        progress_percentage: parseFloat(session.progress_percentage),
        expires_at: session.expires_at,
      },
      viewer_url: `/api/marketplace/digital-downloads/${id}/read?token=${session.session_token}`,
    },
  });
});

/**
 * Update reading progress
 * PUT /api/marketplace/digital-downloads/:id/read-session
 */
export const updateReadProgress = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can update reading progress", 403);
  }

  const { id } = req.params;
  const { current_page, total_pages } = req.body;

  if (!current_page || current_page < 1) {
    throw new ErrorClass("current_page must be at least 1", 400);
  }

  // Get session
  const session = await ReadSession.findOne({
    where: {
      digital_download_id: id,
      student_id: studentId,
      expires_at: {
        [Op.gt]: new Date(),
      },
    },
  });

  if (!session) {
    throw new ErrorClass("Read session not found or expired. Please create a new session.", 404);
  }

  // Get download to calculate progress
  const download = await DigitalDownloads.findByPk(id);
  const totalPages = total_pages || download.pages || session.total_pages || 1;

  // Calculate progress percentage
  const progressPercentage = totalPages > 0
    ? Math.min(100, Math.max(0, (current_page / totalPages) * 100))
    : 0;

  // Update session
  await session.update({
    current_page: parseInt(current_page),
    total_pages: totalPages,
    progress_percentage: parseFloat(progressPercentage.toFixed(2)),
    last_read_at: new Date(),
  });

  res.status(200).json({
    success: true,
    message: "Reading progress updated",
    data: {
      session: {
        id: session.id,
        current_page: session.current_page,
        total_pages: session.total_pages,
        progress_percentage: parseFloat(session.progress_percentage),
        last_read_at: session.last_read_at,
      },
    },
  });
});

/**
 * Get reading progress
 * GET /api/marketplace/digital-downloads/:id/read-session
 */
export const getReadProgress = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can view reading progress", 403);
  }

  const { id } = req.params;

  const session = await ReadSession.findOne({
    where: {
      digital_download_id: id,
      student_id: studentId,
    },
    order: [["last_read_at", "DESC"]],
  });

  if (!session) {
    return res.status(200).json({
      success: true,
      message: "No reading progress found",
      data: {
        progress: null,
      },
    });
  }

  res.status(200).json({
    success: true,
    message: "Reading progress retrieved",
    data: {
      progress: {
        current_page: session.current_page,
        total_pages: session.total_pages,
        progress_percentage: parseFloat(session.progress_percentage),
        last_read_at: session.last_read_at,
        is_session_active: new Date() < new Date(session.expires_at),
      },
    },
  });
});

/**
 * Stream read-only document (PDF viewer)
 * GET /api/marketplace/digital-downloads/:id/read
 */
export const streamReadOnlyDocument = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { token } = req.query;

  if (!token) {
    throw new ErrorClass("Session token is required", 400);
  }

  // Verify session token
  const session = await ReadSession.findOne({
    where: {
      digital_download_id: id,
      session_token: token,
      expires_at: {
        [Op.gt]: new Date(),
      },
    },
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id"],
      },
    ],
  });

  if (!session) {
    throw new ErrorClass("Invalid or expired session token", 403);
  }

  // Get download
  const download = await DigitalDownloads.findByPk(id);

  if (!download || !download.is_read_only || download.status !== "published") {
    throw new ErrorClass("Document not found or not available", 404);
  }

  // Verify purchase
  const purchase = await DigitalDownloadPurchase.findOne({
    where: {
      digital_download_id: id,
      student_id: session.student_id,
      status: "completed",
    },
  });

  if (!purchase) {
    throw new ErrorClass("Access denied", 403);
  }

  // Get file URL (assuming Supabase storage)
  const fileUrl = download.file_url;

  if (!fileUrl) {
    throw new ErrorClass("Document file not found", 404);
  }

  // For Supabase storage, we'll redirect to a signed URL or proxy the file
  // For now, return the URL with security headers instructions
  // In production, you'd want to proxy the file through your server with proper headers

  // Update last_read_at
  await session.update({ last_read_at: new Date() });

  // Return file URL with security instructions
  // Frontend should fetch this URL and display in PDF viewer (e.g., PDF.js)
  res.status(200).json({
    success: true,
    message: "Document access granted",
    data: {
      file_url: fileUrl,
      file_type: download.file_type || "application/pdf",
      session_token: token,
      expires_at: session.expires_at,
      // Security note: Frontend should set these headers when fetching:
      // - X-Frame-Options: SAMEORIGIN (to prevent embedding in other sites)
      // - Content-Disposition: inline (not attachment, to prevent download)
      // - Cache-Control: no-store (to prevent caching)
    },
  });
});

/**
 * Get all read sessions for a student
 * GET /api/marketplace/read-sessions
 */
export const getMyReadSessions = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can view their read sessions", 403);
  }

  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: sessions } = await ReadSession.findAndCountAll({
    where: {
      student_id: studentId,
    },
    include: [
      {
        model: DigitalDownloads,
        as: "download",
        attributes: [
          "id",
          "title",
          "author",
          "cover_image",
          "file_type",
          "pages",
        ],
      },
    ],
    limit: parseInt(limit),
    offset,
    order: [["last_read_at", "DESC"]],
  });

  const formattedSessions = sessions.map((session) => ({
    id: session.id,
    download: session.download
      ? {
          id: session.download.id,
          title: session.download.title,
          author: session.download.author,
          cover_image: session.download.cover_image,
          file_type: session.download.file_type,
          total_pages: session.download.pages,
        }
      : null,
    current_page: session.current_page,
    total_pages: session.total_pages,
    progress_percentage: parseFloat(session.progress_percentage),
    last_read_at: session.last_read_at,
    is_session_active: new Date() < new Date(session.expires_at),
    viewer_url: `/api/marketplace/digital-downloads/${session.digital_download_id}/read?token=${session.session_token}`,
  }));

  res.status(200).json({
    success: true,
    message: "Read sessions retrieved successfully",
    data: {
      sessions: formattedSessions,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});
