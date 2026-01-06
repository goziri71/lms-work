/**
 * IP Geolocation Service
 * Gets location information from IP addresses using free geolocation APIs
 */

import axios from "axios";

/**
 * Get geolocation information from IP address
 * Uses ip-api.com (free, no API key required, 45 requests/minute limit)
 * Falls back to ipapi.co if needed
 * 
 * @param {string} ipAddress - IP address to geolocate
 * @returns {Promise<Object>} Geolocation data
 */
export async function getIPGeolocation(ipAddress) {
  if (!ipAddress || ipAddress === "::1" || ipAddress === "127.0.0.1" || ipAddress.startsWith("192.168.") || ipAddress.startsWith("10.") || ipAddress.startsWith("172.")) {
    // Local/private IP addresses
    return {
      country: null,
      city: null,
      region: null,
      latitude: null,
      longitude: null,
      timezone: null,
      isp: null,
      success: false,
      message: "Local or private IP address",
    };
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
      return {
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
    } else {
      // Try fallback service
      return await getIPGeolocationFallback(ipAddress);
    }
  } catch (error) {
    console.error("IP geolocation error (ip-api.com):", error.message);
    // Try fallback service
    return await getIPGeolocationFallback(ipAddress);
  }
}

/**
 * Fallback geolocation service using ipapi.co
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
    console.error("IP geolocation error (ipapi.co):", error.message);
  }

  // Return default if all services fail
  return {
    country: null,
    city: null,
    region: null,
    latitude: null,
    longitude: null,
    timezone: null,
    isp: null,
    success: false,
    message: "Geolocation service unavailable",
  };
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
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
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
  } else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) {
    os = "iOS";
  }

  return {
    device_type: deviceType,
    browser: browser,
    operating_system: os,
  };
}

