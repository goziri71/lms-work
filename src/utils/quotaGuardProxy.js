/**
 * QuotaGuard Static IP proxy (Heroku add-on / similar).
 * Outbound HTTPS uses QUOTAGUARDSTATIC_URL or QUOTAGUARD_URL so external APIs
 * (e.g. Flutterwave, Careerjet IP allowlists) see one static egress IP.
 *
 * Env is read at call time (not module load) so dotenv / late env injection works.
 */

export function getQuotaGuardProxyUrl() {
  return (
    process.env.QUOTAGUARDSTATIC_URL ||
    process.env.QUOTAGUARD_URL ||
    null
  );
}

export function getQuotaGuardAxiosProxyConfig() {
  const proxyUrl = getQuotaGuardProxyUrl();
  if (!proxyUrl) return null;

  try {
    const parsed = new URL(proxyUrl);
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
