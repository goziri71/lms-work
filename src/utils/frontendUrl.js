/** Default canonical app origin (trailing slash). */
export const DEFAULT_FRONTEND_URL = "https://app.thenomada.com/";

/** Default admin origin (trailing slash). */
export const DEFAULT_ADMIN_FRONTEND_URL = "https://manage.thenomada.com/";

/**
 * Canonical site base: always ends with exactly one `/`.
 * Env may omit or include the slash; output is normalized.
 */
export function normalizeFrontendUrlBase(raw, fallback = DEFAULT_FRONTEND_URL) {
  const t = String(raw ?? "").trim();
  const base = t || fallback;
  const noDup = base.replace(/\/+$/, "");
  return `${noDup}/`;
}

/**
 * Join base (with trailing slash) to a path without double slashes.
 * @param {string} path - e.g. "login" or "/communities/1"
 */
export function joinFrontendUrl(baseRaw, path, fallbackBase = DEFAULT_FRONTEND_URL) {
  const base = normalizeFrontendUrlBase(baseRaw, fallbackBase);
  const p = String(path ?? "").replace(/^\/+/, "");
  return `${base}${p}`;
}
