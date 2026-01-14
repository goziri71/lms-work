/**
 * Google Drive Service
 * Handles Google Drive OAuth and file operations
 */

import { google } from "googleapis";
import { ErrorClass } from "../utils/errorClass/index.js";
import crypto from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || "http://localhost:3000"}/api/marketplace/google-drive/callback`;

/**
 * Get OAuth2 client for Google Drive
 */
function getOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new ErrorClass("Google OAuth credentials not configured", 500);
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate OAuth authorization URL
 * @param {string} state - State parameter for CSRF protection
 * @returns {string} Authorization URL
 */
export function getAuthorizationUrl(state) {
  const oauth2Client = getOAuth2Client();

  const scopes = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state: state,
    prompt: "consent", // Force consent to get refresh token
  });

  return url;
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from OAuth callback
 * @returns {Promise<Object>} Tokens and user info
 */
export async function exchangeCodeForTokens(code) {
  const oauth2Client = getOAuth2Client();

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // Get user info
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      email: userInfo.email,
    };
  } catch (error) {
    console.error("Google OAuth token exchange error:", error);
    throw new ErrorClass("Failed to exchange authorization code for tokens", 500);
  }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New tokens
 */
export async function refreshAccessToken(refreshToken) {
  const oauth2Client = getOAuth2Client();

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    return {
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date,
    };
  } catch (error) {
    console.error("Google token refresh error:", error);
    throw new ErrorClass("Failed to refresh access token", 500);
  }
}

/**
 * Get authenticated Google Drive client
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token (optional)
 * @returns {google.drive.Drive} Drive client
 */
export function getDriveClient(accessToken, refreshToken = null) {
  const oauth2Client = getOAuth2Client();

  oauth2Client.setCredentials({
    access_token: accessToken,
    ...(refreshToken && { refresh_token: refreshToken }),
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * List files from Google Drive
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token (optional)
 * @param {Object} options - Query options (folderId, pageSize, pageToken, q)
 * @returns {Promise<Object>} Files list
 */
export async function listDriveFiles(accessToken, refreshToken, options = {}) {
  const drive = getDriveClient(accessToken, refreshToken);

  const {
    folderId = null,
    pageSize = 100,
    pageToken = null,
    q = null,
  } = options;

  let query = "trashed = false";
  if (folderId) {
    query += ` and '${folderId}' in parents`;
  }
  if (q) {
    query += ` and ${q}`;
  }

  try {
    const response = await drive.files.list({
      q: query,
      pageSize: pageSize,
      pageToken: pageToken,
      fields: "nextPageToken, files(id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink, parents, modifiedTime, createdTime)",
      orderBy: "modifiedTime desc",
    });

    return {
      files: response.data.files || [],
      nextPageToken: response.data.nextPageToken || null,
    };
  } catch (error) {
    console.error("Google Drive list files error:", error);
    throw new ErrorClass("Failed to list files from Google Drive", 500);
  }
}

/**
 * Get file metadata from Google Drive
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token (optional)
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<Object>} File metadata
 */
export async function getFileMetadata(accessToken, refreshToken, fileId) {
  const drive = getDriveClient(accessToken, refreshToken);

  try {
    const response = await drive.files.get({
      fileId: fileId,
      fields: "id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink, parents, modifiedTime, createdTime, permissions",
    });

    return response.data;
  } catch (error) {
    console.error("Google Drive get file error:", error);
    throw new ErrorClass("Failed to get file from Google Drive", 500);
  }
}

/**
 * Generate embed URL for Google Drive file
 * @param {string} fileId - Google Drive file ID
 * @param {string} mimeType - File MIME type
 * @returns {string} Embed URL
 */
export function getEmbedUrl(fileId, mimeType) {
  // Google Drive embed URL format
  if (mimeType && mimeType.startsWith("video/")) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  } else if (mimeType && mimeType.includes("pdf")) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  } else if (mimeType && mimeType.startsWith("image/")) {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  } else {
    // Generic preview
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }
}

/**
 * Generate state parameter for OAuth (CSRF protection)
 * @returns {string} Random state string
 */
export function generateState() {
  return crypto.randomBytes(32).toString("hex");
}
