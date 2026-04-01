/**
 * Google Drive Service
 * Handles Google Drive OAuth and file operations
 */

import { google } from "googleapis";
import jwt from "jsonwebtoken";
import { ErrorClass } from "../utils/errorClass/index.js";
import dotenv from "dotenv";

dotenv.config({ debug: false });

function getGoogleOAuthConfig() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    null;
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    null;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    process.env.GOOGLE_DRIVE_REDIRECT_URI ||
    `${process.env.APP_URL || "http://localhost:3000"}/api/marketplace/google-drive/callback`;

  return { clientId, clientSecret, redirectUri };
}

/**
 * Get OAuth2 client for Google Drive
 */
function getOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();

  if (!clientId || !clientSecret) {
    throw new ErrorClass(
      "Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      500
    );
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}

function normalizeAuthCode(code) {
  if (code == null) return "";
  let c = String(code).trim();
  if (c.includes("%")) {
    try {
      c = decodeURIComponent(c);
    } catch {
      /* keep c */
    }
  }
  return c;
}

/**
 * Build auth URL + signed state with PKCE (required by Google for many OAuth clients).
 */
export async function buildGoogleDriveAuthorizationUrl({ tutorId, tutorType }) {
  const oauth2Client = getOAuth2Client();
  const { codeVerifier, codeChallenge } = await oauth2Client.generateCodeVerifierAsync();
  const state = createGoogleOAuthState({ tutorId, tutorType, codeVerifier });
  const authUrl = getAuthorizationUrl(state, { codeChallenge });
  return { authUrl, state };
}

/**
 * Generate OAuth authorization URL
 * @param {string} state - State parameter for CSRF protection
 * @param {{ codeChallenge?: string }} [options] - PKCE challenge (S256) from generateCodeVerifierAsync
 * @returns {string} Authorization URL
 */
export function getAuthorizationUrl(state, options = {}) {
  const oauth2Client = getOAuth2Client();
  const { codeChallenge } = options;

  const scopes = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
  ];

  const params = {
    access_type: "offline",
    scope: scopes,
    state: state,
    prompt: "consent",
  };

  if (codeChallenge) {
    params.code_challenge = codeChallenge;
    params.code_challenge_method = "S256";
  }

  const url = oauth2Client.generateAuthUrl(params);

  return url;
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from OAuth callback
 * @param {string|null} codeVerifier - PKCE verifier from signed state (required when auth URL used PKCE)
 * @returns {Promise<Object>} Tokens and user info
 */
export async function exchangeCodeForTokens(code, codeVerifier = null) {
  const oauth2Client = getOAuth2Client();
  const { redirectUri } = getGoogleOAuthConfig();
  const normalized = normalizeAuthCode(code);

  if (!normalized) {
    throw new ErrorClass("Authorization code is missing or empty", 400);
  }

  try {
    const tokenOpts = {
      code: normalized,
      redirect_uri: redirectUri,
    };
    if (codeVerifier) {
      tokenOpts.codeVerifier = codeVerifier;
    }

    const { tokens } = await oauth2Client.getToken(tokenOpts);

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
    const data = error?.response?.data;
    const errCode = data?.error;
    const errDesc = data?.error_description || error?.message;
    console.error("Google OAuth token exchange error:", errCode || errDesc || error);
    if (data) console.error("Google token response:", JSON.stringify(data));
    const { redirectUri: ru } = getGoogleOAuthConfig();
    if (errCode === "redirect_uri_mismatch" || String(errDesc || "").includes("redirect_uri")) {
      throw new ErrorClass(
        `redirect_uri_mismatch: server uses "${ru}". Add this exact URL to Google Cloud OAuth client Authorized redirect URIs.`,
        400
      );
    }
    if (errCode === "invalid_grant") {
      throw new ErrorClass(
        "Google could not accept this authorization code (invalid_grant). It may already have been used, expired, or the sign-in was interrupted. Click Connect again in the app and finish Google in one go — do not refresh or open the callback URL twice.",
        400
      );
    }
    const extra = errDesc ? ` ${errDesc}` : "";
    throw new ErrorClass(`Failed to exchange authorization code for tokens.${extra}`, 500);
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
 * Signed OAuth state so the browser callback (no JWT header) can be tied to a tutor.
 */
export function createGoogleOAuthState({ tutorId, tutorType, codeVerifier }) {
  const secret = process.env.JWT_SECRET || "your-secret";
  const payload = {
    purpose: "google_drive_oauth",
    tutorId,
    tutorType,
  };
  if (codeVerifier) {
    payload.cv = codeVerifier;
  }
  return jwt.sign(payload, secret, { expiresIn: "15m", algorithm: "HS256" });
}

/**
 * Verify state from Google redirect and return tutor identity + PKCE verifier.
 */
export function verifyGoogleOAuthState(state) {
  if (!state || typeof state !== "string") {
    throw new ErrorClass("OAuth state is required", 400);
  }
  const secret = process.env.JWT_SECRET || "your-secret";
  try {
    const decoded = jwt.verify(state, secret);
    if (decoded.purpose !== "google_drive_oauth") {
      throw new Error("invalid purpose");
    }
    if (decoded.tutorId == null || !decoded.tutorType) {
      throw new Error("invalid payload");
    }
    return {
      tutorId: decoded.tutorId,
      tutorType: decoded.tutorType,
      codeVerifier: decoded.cv || null,
    };
  } catch {
    throw new ErrorClass(
      "Invalid or expired OAuth state. Please start Google Drive connect again from the app.",
      400
    );
  }
}

