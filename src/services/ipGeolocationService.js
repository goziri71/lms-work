/**
 * IP Geolocation Service
 * Gets location information from IP addresses using free geolocation APIs
 */

import axios from "axios";

// In-memory cache to reduce API calls and avoid rate limits (429)
// Key: ipAddress, Value: { data, expiry }
const geolocationCache = new Map();
const CACHE_TTL_SUCCESS_MS = 60 * 60 * 1000; // 1 hour for success
const CACHE_TTL_RATE_LIMIT_MS = 5 * 60 * 1000; // 5 min for 429 so we don't retry immediately

function getDefaultResult(message = "Geolocation service unavailable") {
  return {
    country: null,
    city: null,
    region: null,
    latitude: null,
    longitude: null,
    timezone: null,
    isp: null,
    success: false,
    message,
  };
}

/**
 * Get geolocation information from IP address
 * Uses ip-api.com (free, no API key required, 45 requests/minute limit)
 * Falls back to ipapi.co if needed. Caches results to avoid 429 rate limits.
 *
 * @param {string} ipAddress - IP address to geolocate
 * @returns {Promise<Object>} Geolocation data
 */
export async function getIPGeolocation(ipAddress) {
  if (
    !ipAddress ||
    ipAddress === "::1" ||
    ipAddress === "127.0.0.1" ||
    ipAddress.startsWith("192.168.") ||
    ipAddress.startsWith("10.") ||
    ipAddress.startsWith("172.")
  ) {
    return {
      ...getDefaultResult("Local or private IP address"),
    };
  }

  const cached = geolocationCache.get(ipAddress);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  try {
    // Try ip-api.com first (free, no API key, 45 req/min)
    const response = await axios.get(`http://ip-api.com/json/${ipAddress}`, {
      timeout: 5000,
      params: {
        fields: "status,message,country,regionName,city,lat,lon,timezone,isp",
      },
    });

    if (response.data.status === "success") {
      const data = {
        country: response.data.country || null,
        city: response.data.city || null,
        region: response.data.regionName || null,
        latitude: response.data.lat || null,
        longitude: response.data.lon || null,
        timezone: response.data.timezone || null,
        isp: response.data.isp || null,
        success: true,
        source: "ip-api.com",
      };
      geolocationCache.set(ipAddress, {
        data,
        expiry: Date.now() + CACHE_TTL_SUCCESS_MS,
      });
      return data;
    } else {
      return await getIPGeolocationFallback(ipAddress);
    }
  } catch (error) {
    const status = error.response?.status;
    if (status === 429) {
      const data = getDefaultResult("Rate limit exceeded (429)");
      geolocationCache.set(ipAddress, {
        data,
        expiry: Date.now() + CACHE_TTL_RATE_LIMIT_MS,
      });
      return data;
    }
    const data = await getIPGeolocationFallback(ipAddress);
    if (!data.success) {
      geolocationCache.set(ipAddress, {
        data,
        expiry: Date.now() + CACHE_TTL_RATE_LIMIT_MS,
      });
    }
    return data;
  }
}

/**
 * Fallback geolocation service using ipapi.co (rate limited: ~1000/day free)
 * @param {string} ipAddress - IP address to geolocate
 * @returns {Promise<Object>} Geolocation data
 */
async function getIPGeolocationFallback(ipAddress) {
  try {
    const response = await axios.get(`https://ipapi.co/${ipAddress}/json/`, {
      timeout: 5000,
    });

    if (response.data && !response.data.error) {
      return {
        country: response.data.country_name || null,
        city: response.data.city || null,
        region: response.data.region || null,
        latitude: response.data.latitude || null,
        longitude: response.data.longitude || null,
        timezone: response.data.timezone || null,
        isp: response.data.org || null,
        success: true,
        source: "ipapi.co",
      };
    }
  } catch (error) {
    const status = error.response?.status;
    if (status === 429) {
      // Rate limited - avoid logging as error; cache failure to reduce retries
      return getDefaultResult("Rate limit exceeded (429)");
    }
    // Only log non-429 errors to reduce noise
    if (status !== 429) {
      console.warn("IP geolocation (ipapi.co):", error.message);
    }
  }

  return getDefaultResult();
}

/**
 * Parse user agent to extract device and browser information
 * @param {string} userAgent - User agent string
 * @returns {Object} Parsed device and browser info
 */
export function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      device_type: null,
      browser: null,
      operating_system: null,
    };
  }

  const ua = userAgent.toLowerCase();

  // Detect device type
  let deviceType = "desktop";
  if (
    ua.includes("mobile") ||
    ua.includes("android") ||
    ua.includes("iphone")
  ) {
    deviceType = "mobile";
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    deviceType = "tablet";
  }

  // Detect browser
  let browser = "Unknown";
  if (ua.includes("chrome") && !ua.includes("edg")) {
    browser = "Chrome";
  } else if (ua.includes("firefox")) {
    browser = "Firefox";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browser = "Safari";
  } else if (ua.includes("edg")) {
    browser = "Edge";
  } else if (ua.includes("opera") || ua.includes("opr")) {
    browser = "Opera";
  }

  // Detect OS
  let os = "Unknown";
  if (ua.includes("windows")) {
    os = "Windows";
  } else if (ua.includes("mac os") || ua.includes("macos")) {
    os = "macOS";
  } else if (ua.includes("linux")) {
    os = "Linux";
  } else if (ua.includes("android")) {
    os = "Android";
  } else if (
    ua.includes("ios") ||
    ua.includes("iphone") ||
    ua.includes("ipad")
  ) {
    os = "iOS";
  }

  return {
    device_type: deviceType,
    browser: browser,
    operating_system: os,
  };
}
