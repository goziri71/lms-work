import axios from "axios";
import crypto from "crypto";
import { JobCache } from "../models/marketplace/jobCache.js";
import { Op } from "sequelize";

const BASE_URL =
  "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs";
const API_KEY = "jobboerse-jobsuche";

const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DB_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const memoryCache = new Map();
let isJobCacheTableAvailable = true;

const BLOCKED_ARBEITSZEIT = ["vz"];
const ALLOWED_ARBEITSZEIT = ["tz", "ho", "snw", "mj"];
const ALLOWED_ANGEBOTSART = ["1", "2", "4", "34"];

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
    was,
    berufsfeld,
    arbeitszeit,
    angebotsart,
    befristung,
    veroeffentlichtseit,
    zeitarbeit,
    arbeitgeber,
    page = 1,
    size = 25,
  } = searchParams;

  // Build the query parameters for the external API
  const queryParams = {};

  if (was && was.trim()) queryParams.was = was.trim();
  if (berufsfeld && berufsfeld.trim()) queryParams.berufsfeld = berufsfeld.trim();

  if (arbeitszeit) {
    const values = arbeitszeit
      .split(";")
      .map((v) => v.trim().toLowerCase())
      .filter((v) => ALLOWED_ARBEITSZEIT.includes(v) && !BLOCKED_ARBEITSZEIT.includes(v));
    if (values.length > 0) queryParams.arbeitszeit = values.join(";");
  }

  if (angebotsart) {
    const val = String(angebotsart).trim();
    if (ALLOWED_ANGEBOTSART.includes(val)) queryParams.angebotsart = val;
  }

  if (befristung) {
    const val = String(befristung).trim();
    if (["1", "2"].includes(val)) queryParams.befristung = val;
  }

  if (veroeffentlichtseit !== undefined && veroeffentlichtseit !== null) {
    const days = parseInt(veroeffentlichtseit, 10);
    if (!isNaN(days) && days >= 0 && days <= 100) {
      queryParams.veroeffentlichtseit = days;
    }
  }

  if (zeitarbeit !== undefined) {
    queryParams.zeitarbeit = zeitarbeit === "true" || zeitarbeit === true;
  }

  if (arbeitgeber && arbeitgeber.trim()) queryParams.arbeitgeber = arbeitgeber.trim();

  queryParams.page = Math.max(1, parseInt(page, 10) || 1);
  queryParams.size = Math.min(100, Math.max(1, parseInt(size, 10) || 25));

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
    const response = await axios.get(BASE_URL, {
      headers: {
        "X-API-Key": API_KEY,
      },
      params: queryParams,
      timeout: 15000,
    });

    const responseData = {
      jobs: response.data?.stellenangebote || response.data?.jobs || [],
      total: response.data?.maxErgebnisse || response.data?.total || 0,
      page: queryParams.page,
      size: queryParams.size,
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
    console.error("German Job API call failed:", apiErr.message);

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
