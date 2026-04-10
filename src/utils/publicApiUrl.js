/**
 * Public origin for this API (scheme + host + port only, no path).
 * Used for OAuth redirect URIs, webhooks, etc.
 *
 * If PUBLIC_API_URL mistakenly includes a path (e.g. a frontend route),
 * we strip to the origin so callbacks are not doubled like
 * host/path.../api/marketplace/...
 */
export function resolvePublicApiBase() {
  const raw =
    process.env.PUBLIC_API_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000";
  try {
    const normalized = /^https?:\/\//i.test(raw)
      ? raw
      : /^(localhost|127\.0\.0\.1)/i.test(raw)
        ? `http://${raw}`
        : `https://${raw}`;
    const u = new URL(normalized);
    const port =
      u.port && u.port !== "80" && u.port !== "443" ? `:${u.port}` : "";
    return `${u.protocol}//${u.hostname}${port}`;
  } catch {
    return raw.replace(/\/$/, "");
  }
}
