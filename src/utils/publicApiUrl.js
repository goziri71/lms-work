/**
 * Public HTTPS base for this API (no trailing slash).
 * Used for OAuth redirect URIs, webhooks, etc.
 */
export function resolvePublicApiBase() {
  const raw =
    process.env.PUBLIC_API_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
