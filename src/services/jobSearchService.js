import axios from "axios";
import crypto from "crypto";
import { JobCache } from "../models/marketplace/jobCache.js";
import { Op } from "sequelize";
import { getQuotaGuardAxiosProxyConfig } from "../utils/quotaGuardProxy.js";
import { ErrorClass } from "../utils/errorClass/index.js";

const BASE_URL = "https://search.api.careerjet.net/v4/query";
const API_KEY = process.env.CAREERJET_API_KEY || process.env.CAREERJET_KEY || "";
const DEFAULT_LOCALE = process.env.CAREERJET_LOCALE || "en_NG";

/** Careerjet locale_code format, e.g. en_US, fr_FR, en_NG */
const LOCALE_CODE_RE = /^[a-z]{2}_[A-Z]{2}$/;

/**
 * Resolve Careerjet locale: optional request override, else env/default.
 * @param {string|undefined} locale - from query `locale` or `locale_code`
 */
function resolveLocaleCode(locale) {
  if (locale === undefined || locale === null || String(locale).trim() === "") {
    return DEFAULT_LOCALE;
  }
  const s = String(locale).trim();
  if (!LOCALE_CODE_RE.test(s)) {
    throw new ErrorClass(
      "Invalid locale. Use Careerjet locale_code (e.g. en_US, en_GB, de_DE, en_NG). See Careerjet partner docs for supported locales.",
      400
    );
  }
  return s;
}

/**
 * Careerjet requires a Referer matching the publisher page that triggers the search.
 * @see https://www.careerjet.com/partners/api/javascript
 */
function getCareerjetReferer() {
  const explicit = process.env.CAREERJET_REFERER?.trim();
  if (explicit) return explicit;
  const base =
    process.env.PUBLIC_API_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "");
  if (base) {
    return `${base}/marketplace/jobs`;
  }
  return "https://localhost/marketplace/jobs";
}

function shouldUseQuotaGuardProxy() {
  if (process.env.CAREERJET_USE_QUOTAGUARD === "false") return false;
  return true;
}

const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DB_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const memoryCache = new Map();
let isJobCacheTableAvailable = true;

function buildCacheKey(params) {
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
        acc[key] = params[key];
      }
      return acc;
    }, {});
  return crypto.createHash("md5").update(JSON.stringify(sorted)).digest("hex");
}

function cleanExpiredMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of memoryCache) {
    if (entry.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Search jobs with hybrid caching (memory -> DB -> external API)
 */
export async function searchJobs(searchParams = {}) {
  const {
    locale,
    was,
    location,
    berufsfeld,
    arbeitszeit,
    angebotsart,
    befristung,
    veroeffentlichtseit,
    zeitarbeit,
    arbeitgeber,
    user_ip,
    user_agent,
    page = 1,
    size = 25,
  } = searchParams;

  if (!API_KEY) {
    throw new Error(
      "Careerjet API key not configured. Set CAREERJET_API_KEY in environment."
    );
  }

  // Build the query parameters for Careerjet API
  const queryParams = {};
  const keywordParts = [];
  if (was && String(was).trim()) keywordParts.push(String(was).trim());
  if (berufsfeld && String(berufsfeld).trim()) {
    keywordParts.push(String(berufsfeld).trim());
  }
  if (arbeitgeber && String(arbeitgeber).trim()) {
    keywordParts.push(String(arbeitgeber).trim());
  }

  queryParams.locale_code = resolveLocaleCode(locale);
  queryParams.keywords = keywordParts.join(" ").trim() || "jobs";
  if (location && String(location).trim()) {
    queryParams.location = String(location).trim();
  }
  queryParams.user_ip = user_ip || "127.0.0.1";
  queryParams.user_agent = user_agent || "Mozilla/5.0";
  queryParams.page = Math.max(1, parseInt(page, 10) || 1);
  queryParams.page_size = Math.min(100, Math.max(1, parseInt(size, 10) || 25));
  // Keep these for cache/debug visibility in returned metadata
  if (arbeitszeit) queryParams.arbeitszeit = arbeitszeit;
  if (angebotsart) queryParams.angebotsart = angebotsart;
  if (befristung) queryParams.befristung = befristung;
  if (veroeffentlichtseit !== undefined) {
    queryParams.veroeffentlichtseit = veroeffentlichtseit;
  }
  if (zeitarbeit !== undefined) queryParams.zeitarbeit = zeitarbeit;

  const cacheKey = buildCacheKey(queryParams);

  // 1. Check memory cache
  cleanExpiredMemoryCache();
  const memEntry = memoryCache.get(cacheKey);
  if (memEntry && memEntry.expiresAt > Date.now()) {
    return { ...memEntry.data, cache_source: "memory" };
  }

  // 2. Check database cache
  if (isJobCacheTableAvailable) {
    try {
      const dbEntry = await JobCache.findOne({
        where: {
          cache_key: cacheKey,
          expires_at: { [Op.gt]: new Date() },
        },
      });

      if (dbEntry) {
        // Refresh memory cache from DB
        memoryCache.set(cacheKey, {
          data: dbEntry.response_data,
          expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
        });
        return { ...dbEntry.response_data, cache_source: "database" };
      }
    } catch (dbErr) {
      if (dbErr?.message?.includes('relation "job_cache" does not exist')) {
        isJobCacheTableAvailable = false;
        console.warn("Job cache table missing; continuing with memory/API cache only.");
      } else {
        console.warn("Job cache DB lookup failed:", dbErr.message);
      }
    }
  }

  // 3. Call external API
  try {
    const basicAuthHeader = `Basic ${Buffer.from(`${API_KEY}:`).toString("base64")}`;
    const proxyConfig = shouldUseQuotaGuardProxy()
      ? getQuotaGuardAxiosProxyConfig()
      : null;

    const response = await axios.get(BASE_URL, {
      headers: {
        Authorization: basicAuthHeader,
        "Content-Type": "application/json",
        Referer: getCareerjetReferer(),
      },
      params: queryParams,
      timeout: 15000,
      ...(proxyConfig ? { proxy: proxyConfig } : {}),
      validateStatus: (s) => s >= 200 && s < 300,
    });

    const data = response.data || {};
    if (data.type === "ERROR" || data.error) {
      console.error("Careerjet API returned error payload:", data);
      throw new Error(data.error || data.hint || "Careerjet API error");
    }
    const responseData = {
      jobs: data.jobs || [],
      total: data.hits ?? data.total ?? 0,
      page: queryParams.page,
      size: queryParams.page_size,
      search_params: queryParams,
    };

    // Save to memory cache
    memoryCache.set(cacheKey, {
      data: responseData,
      expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
    });

    // Save to database cache (non-blocking)
    if (isJobCacheTableAvailable) {
      JobCache.upsert({
        cache_key: cacheKey,
        search_params: queryParams,
        response_data: responseData,
        total_results: responseData.total,
        expires_at: new Date(Date.now() + DB_CACHE_TTL_MS),
      }).catch((err) => {
        if (err?.message?.includes('relation "job_cache" does not exist')) {
          isJobCacheTableAvailable = false;
          console.warn("Job cache table missing; DB cache disabled.");
          return;
        }
        console.warn("Job cache DB save failed:", err.message);
      });
    }

    return { ...responseData, cache_source: "api" };
  } catch (apiErr) {
    const status = apiErr.response?.status;
    const body = apiErr.response?.data;
    console.error("Careerjet API call failed:", {
      message: apiErr.message,
      code: apiErr.code,
      status,
      data: typeof body === "string" ? body : body,
    });

    // Fallback: serve stale DB cache if available
    try {
      if (isJobCacheTableAvailable) {
        const staleEntry = await JobCache.findOne({
          where: { cache_key: cacheKey },
          order: [["updated_at", "DESC"]],
        });

        if (staleEntry) {
          return { ...staleEntry.response_data, cache_source: "stale_database" };
        }
      }
    } catch (fallbackErr) {
      if (fallbackErr?.message?.includes('relation "job_cache" does not exist')) {
        isJobCacheTableAvailable = false;
      } else {
        console.warn("Stale cache fallback failed:", fallbackErr.message);
      }
    }

    throw new Error(
      "Job search is temporarily unavailable. Please try again later."
    );
  }
}

/**
 * Clean up expired DB cache entries.
 * Call periodically or on each request (lazy cleanup).
 */
export async function cleanupExpiredCache() {
  try {
    if (!isJobCacheTableAvailable) return 0;
    const deleted = await JobCache.destroy({
      where: { expires_at: { [Op.lt]: new Date() } },
    });
    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} expired job cache entries`);
    }
    return deleted;
  } catch (err) {
    if (err?.message?.includes('relation "job_cache" does not exist')) {
      isJobCacheTableAvailable = false;
      return 0;
    }
    console.warn("Job cache cleanup failed:", err.message);
    return 0;
  }
}
