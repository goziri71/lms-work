import { encryptToken, decryptToken, looksEncryptedToken } from "../utils/tokenEncryption.js";

function revealToken(stored) {
  if (!stored) return { token: "", decryptFailed: false };
  const decrypted = decryptToken(stored);
  if (decrypted) return { token: decrypted, decryptFailed: false };

  const raw = String(stored);
  // Legacy rows stored plaintext OAuth tokens
  if (raw.startsWith("ya29.") || raw.startsWith("1//") || raw.startsWith("eyJ")) {
    return { token: raw, decryptFailed: false };
  }

  return {
    token: "",
    decryptFailed: looksEncryptedToken(raw),
  };
}

export function storeEncryptedTokens(mailbox, { access_token, refresh_token, expires_in, scope }) {
  const expiresAt =
    expires_in != null ? new Date(Date.now() + Number(expires_in) * 1000) : null;
  return mailbox.update({
    access_token: encryptToken(access_token),
    refresh_token: refresh_token != null ? encryptToken(refresh_token) : mailbox.refresh_token,
    token_expires_at: expiresAt,
    scope: scope || mailbox.scope,
  });
}

export function getDecryptedTokens(mailbox) {
  const access = revealToken(mailbox.access_token);
  const refresh = revealToken(mailbox.refresh_token || "");
  return {
    access_token: access.token,
    refresh_token: refresh.token,
    decrypt_failed: !!(access.decryptFailed || refresh.decryptFailed),
  };
}

export function mailboxNeedsReconnect(mailbox) {
  const { access_token, refresh_token, decrypt_failed } = getDecryptedTokens(mailbox);
  return decrypt_failed || (!access_token && !refresh_token);
}
