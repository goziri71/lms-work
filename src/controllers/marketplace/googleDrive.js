/**
 * Google Drive Controller
 * Handles Google Drive OAuth and file management for tutors
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { GoogleDriveConnection } from "../../models/marketplace/googleDriveConnection.js";
import { ExternalFile } from "../../models/marketplace/externalFile.js";
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  listDriveFiles,
  getFileMetadata,
  getEmbedUrl,
  generateState,
} from "../../services/googleDriveService.js";
import { Op } from "sequelize";

/**
 * Initiate Google Drive OAuth connection
 * GET /api/marketplace/google-drive/connect
 */
export const initiateGoogleDriveConnection = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const tutorType = req.tutor?.tutorType;

  if (!tutorId || !tutorType) {
    throw new ErrorClass("Tutor information not found", 401);
  }

  // Check if connection already exists
  const existingConnection = await GoogleDriveConnection.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      is_active: true,
    },
  });

  if (existingConnection) {
    return res.status(200).json({
      success: true,
      message: "Google Drive connection already exists",
      data: {
        connected: true,
        email: existingConnection.google_account_email,
        connected_at: existingConnection.connected_at,
      },
    });
  }

  // Generate state for CSRF protection (store in session or return to frontend)
  const state = generateState();

  // Generate authorization URL
  const authUrl = getAuthorizationUrl(state);

  res.status(200).json({
    success: true,
    message: "Google Drive authorization URL generated",
    data: {
      authorization_url: authUrl,
      state: state, // Frontend should store this and verify on callback
    },
  });
});

/**
 * Handle Google Drive OAuth callback
 * GET /api/marketplace/google-drive/callback
 */
export const handleGoogleDriveCallback = TryCatchFunction(async (req, res) => {
  const { code, state } = req.query;
  const tutorId = req.tutor?.id;
  const tutorType = req.tutor?.tutorType;

  if (!code) {
    throw new ErrorClass("Authorization code is required", 400);
  }

  if (!tutorId || !tutorType) {
    throw new ErrorClass("Tutor information not found", 401);
  }

  // Exchange code for tokens
  const tokenData = await exchangeCodeForTokens(code);

  // Check if connection already exists
  let connection = await GoogleDriveConnection.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (connection) {
    // Update existing connection
    await connection.update({
      google_account_email: tokenData.email,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || connection.refresh_token,
      token_expires_at: tokenData.expiry_date ? new Date(tokenData.expiry_date) : null,
      scope: tokenData.scope,
      is_active: true,
      connected_at: new Date(),
    });
  } else {
    // Create new connection
    connection = await GoogleDriveConnection.create({
      tutor_id: tutorId,
      tutor_type: tutorType,
      google_account_email: tokenData.email,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: tokenData.expiry_date ? new Date(tokenData.expiry_date) : null,
      scope: tokenData.scope,
      is_active: true,
      connected_at: new Date(),
    });
  }

  res.status(200).json({
    success: true,
    message: "Google Drive connected successfully",
    data: {
      connection: {
        id: connection.id,
        email: connection.google_account_email,
        connected_at: connection.connected_at,
      },
    },
  });
});

/**
 * Get Google Drive connection status
 * GET /api/marketplace/google-drive/connection
 */
export const getGoogleDriveConnection = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const tutorType = req.tutor?.tutorType;

  if (!tutorId || !tutorType) {
    throw new ErrorClass("Tutor information not found", 401);
  }

  const connection = await GoogleDriveConnection.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      is_active: true,
    },
  });

  if (!connection) {
    return res.status(200).json({
      success: true,
      message: "No Google Drive connection found",
      data: {
        connected: false,
      },
    });
  }

  res.status(200).json({
    success: true,
    message: "Google Drive connection retrieved",
    data: {
      connected: true,
      email: connection.google_account_email,
      connected_at: connection.connected_at,
      last_sync_at: connection.last_sync_at,
    },
  });
});

/**
 * Disconnect Google Drive
 * DELETE /api/marketplace/google-drive/connection
 */
export const disconnectGoogleDrive = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const tutorType = req.tutor?.tutorType;

  if (!tutorId || !tutorType) {
    throw new ErrorClass("Tutor information not found", 401);
  }

  const connection = await GoogleDriveConnection.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!connection) {
    throw new ErrorClass("Google Drive connection not found", 404);
  }

  await connection.update({
    is_active: false,
  });

  res.status(200).json({
    success: true,
    message: "Google Drive disconnected successfully",
  });
});

/**
 * List files from Google Drive
 * GET /api/marketplace/google-drive/files
 */
export const listGoogleDriveFiles = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const tutorType = req.tutor?.tutorType;

  if (!tutorId || !tutorType) {
    throw new ErrorClass("Tutor information not found", 401);
  }

  const { folderId, pageSize = 50, pageToken, q } = req.query;

  // Get active connection
  const connection = await GoogleDriveConnection.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      is_active: true,
    },
  });

  if (!connection) {
    throw new ErrorClass("Google Drive connection not found. Please connect your Google Drive first.", 404);
  }

  // Check if token needs refresh
  let accessToken = connection.access_token;
  let refreshToken = connection.refresh_token;

  if (connection.token_expires_at && new Date() >= connection.token_expires_at) {
    if (!refreshToken) {
      throw new ErrorClass("Access token expired and no refresh token available. Please reconnect.", 401);
    }

    const newTokens = await refreshAccessToken(refreshToken);
    accessToken = newTokens.access_token;

    await connection.update({
      access_token: accessToken,
      token_expires_at: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null,
    });
  }

  // List files from Google Drive
  const result = await listDriveFiles(accessToken, refreshToken, {
    folderId: folderId || null,
    pageSize: parseInt(pageSize),
    pageToken: pageToken || null,
    q: q || null,
  });

  res.status(200).json({
    success: true,
    message: "Files retrieved successfully",
    data: {
      files: result.files,
      next_page_token: result.nextPageToken,
    },
  });
});

/**
 * Import files from Google Drive (bulk import)
 * POST /api/marketplace/google-drive/import
 */
export const importGoogleDriveFiles = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const tutorType = req.tutor?.tutorType;

  if (!tutorId || !tutorType) {
    throw new ErrorClass("Tutor information not found", 401);
  }

  const { file_ids, folder_id, tags, description } = req.body;

  // Get active connection
  const connection = await GoogleDriveConnection.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      is_active: true,
    },
  });

  if (!connection) {
    throw new ErrorClass("Google Drive connection not found. Please connect your Google Drive first.", 404);
  }

  // Check if token needs refresh
  let accessToken = connection.access_token;
  let refreshToken = connection.refresh_token;

  if (connection.token_expires_at && new Date() >= connection.token_expires_at) {
    if (!refreshToken) {
      throw new ErrorClass("Access token expired and no refresh token available. Please reconnect.", 401);
    }

    const newTokens = await refreshAccessToken(refreshToken);
    accessToken = newTokens.access_token;

    await connection.update({
      access_token: accessToken,
      token_expires_at: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null,
    });
  }

  // Determine which files to import
  let filesToImport = [];

  if (file_ids && Array.isArray(file_ids) && file_ids.length > 0) {
    // Import specific files
    for (const fileId of file_ids) {
      try {
        const fileMetadata = await getFileMetadata(accessToken, refreshToken, fileId);
        filesToImport.push(fileMetadata);
      } catch (error) {
        console.error(`Error fetching file ${fileId}:`, error);
      }
    }
  } else if (folder_id) {
    // Import all files from folder
    const result = await listDriveFiles(accessToken, refreshToken, {
      folderId: folder_id,
      pageSize: 1000,
    });
    filesToImport = result.files;
  } else {
    throw new ErrorClass("Either file_ids array or folder_id is required", 400);
  }

  // Import files
  const importedFiles = [];
  const errors = [];

  for (const file of filesToImport) {
    try {
      // Check if file already imported
      const existing = await ExternalFile.findOne({
        where: {
          tutor_id: tutorId,
          tutor_type: tutorType,
          external_file_id: file.id,
          status: "active",
        },
      });

      if (existing) {
        errors.push({
          file_id: file.id,
          file_name: file.name,
          error: "File already imported",
        });
        continue;
      }

      // Generate embed URL
      const embedUrl = getEmbedUrl(file.id, file.mimeType);

      // Create external file record
      const externalFile = await ExternalFile.create({
        tutor_id: tutorId,
        tutor_type: tutorType,
        google_drive_connection_id: connection.id,
        file_name: file.name,
        file_type: file.mimeType,
        file_size: file.size ? parseInt(file.size) : null,
        storage_type: "google_drive",
        external_file_id: file.id,
        external_file_url: file.webContentLink || file.webViewLink || null,
        embed_url: embedUrl,
        thumbnail_url: file.thumbnailLink || null,
        folder_path: folder_id || null,
        description: description || null,
        tags: tags && Array.isArray(tags) ? tags : null,
        imported_at: new Date(),
        status: "active",
      });

      importedFiles.push(externalFile);
    } catch (error) {
      console.error(`Error importing file ${file.id}:`, error);
      errors.push({
        file_id: file.id,
        file_name: file.name,
        error: error.message,
      });
    }
  }

  // Update last sync time
  await connection.update({
    last_sync_at: new Date(),
  });

  res.status(200).json({
    success: true,
    message: `Imported ${importedFiles.length} file(s) successfully`,
    data: {
      imported: importedFiles.length,
      failed: errors.length,
      files: importedFiles,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
});

/**
 * Get imported external files
 * GET /api/marketplace/google-drive/files/imported
 */
export const getImportedFiles = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const tutorType = req.tutor?.tutorType;

  if (!tutorId || !tutorType) {
    throw new ErrorClass("Tutor information not found", 401);
  }

  const { page = 1, limit = 20, status = "active", storage_type } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    tutor_id: tutorId,
    tutor_type: tutorType,
    status: status,
  };

  if (storage_type) {
    where.storage_type = storage_type;
  }

  const { count, rows: files } = await ExternalFile.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["imported_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Imported files retrieved successfully",
    data: {
      files,
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
 * Get single external file with embed URL
 * GET /api/marketplace/google-drive/files/:id
 */
export const getExternalFile = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const tutorType = req.tutor?.tutorType;

  if (!tutorId || !tutorType) {
    throw new ErrorClass("Tutor information not found", 401);
  }

  const { id } = req.params;

  const file = await ExternalFile.findOne({
    where: {
      id: parseInt(id),
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!file) {
    throw new ErrorClass("File not found", 404);
  }

  // Update last accessed time
  await file.update({
    last_accessed_at: new Date(),
  });

  res.status(200).json({
    success: true,
    message: "File retrieved successfully",
    data: {
      file: {
        id: file.id,
        file_name: file.file_name,
        file_type: file.file_type,
        file_size: file.file_size,
        embed_url: file.embed_url,
        external_file_url: file.external_file_url,
        thumbnail_url: file.thumbnail_url,
        description: file.description,
        tags: file.tags,
        imported_at: file.imported_at,
      },
    },
  });
});

/**
 * Delete/Archive external file
 * DELETE /api/marketplace/google-drive/files/:id
 */
export const deleteExternalFile = TryCatchFunction(async (req, res) => {
  const tutorId = req.tutor?.id;
  const tutorType = req.tutor?.tutorType;

  if (!tutorId || !tutorType) {
    throw new ErrorClass("Tutor information not found", 401);
  }

  const { id } = req.params;

  const file = await ExternalFile.findOne({
    where: {
      id: parseInt(id),
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!file) {
    throw new ErrorClass("File not found", 404);
  }

  await file.update({
    status: "deleted",
  });

  res.status(200).json({
    success: true,
    message: "File deleted successfully",
  });
});
