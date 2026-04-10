/**
 * QuotaGuard Static IP proxy (Heroku add-on / similar).
 * Outbound HTTPS uses QUOTAGUARDSTATIC_URL or QUOTAGUARD_URL so external APIs
 * (e.g. Flutterwave, Careerjet IP allowlists) see one static egress IP.
 */
const QUOTAGUARD_PROXY_URL =
  process.env.QUOTAGUARDSTATIC_URL || process.env.QUOTAGUARD_URL || null;

export function getQuotaGuardAxiosProxyConfig() {
  if (!QUOTAGUARD_PROXY_URL) return null;

  try {
    const parsed = new URL(QUOTAGUARD_PROXY_URL);
    const host = parsed.hostname;
    const port = Number(parsed.port);
    const protocol = parsed.protocol?.replace(":", "");
    const username = decodeURIComponent(parsed.username || "");
    const password = decodeURIComponent(parsed.password || "");

    if (!host || !Number.isInteger(port) || port <= 0) {
      return null;
    }

    return {
      protocol: protocol || "http",
      host,
      port,
      auth:
        username || password
          ? {
              username,
              password,
            }
          : undefined,
    };
  } catch {
    return null;
  }
}
