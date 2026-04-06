import { encryptToken, decryptToken } from "../utils/tokenEncryption.js";

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
  return {
    access_token: decryptToken(mailbox.access_token),
    refresh_token: decryptToken(mailbox.refresh_token || ""),
  };
}
