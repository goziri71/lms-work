/**
 * Currency Detection and Management Service
 * Handles country-to-currency mapping and currency detection
 */

// ISO Country Code to Currency Mapping
// Based on Flutterwave supported countries
const ISO_COUNTRY_CURRENCY_MAP = {
  // African Countries
  NG: "NGN", // Nigeria
  GH: "GHS", // Ghana
  KE: "KES", // Kenya
  ZA: "ZAR", // South Africa
  UG: "UGX", // Uganda
  TZ: "TZS", // Tanzania
  RW: "RWF", // Rwanda
  ZM: "ZMW", // Zambia
  CM: "XAF", // Cameroon
  CI: "XOF", // Ivory Coast
  SN: "XOF", // Senegal
  MW: "MWK", // Malawi
  MU: "MUR", // Mauritius
  EG: "EGP", // Egypt
  MZ: "MZN", // Mozambique
  
  // European Countries
  GB: "GBP", // United Kingdom
  FR: "EUR", // France
  DE: "EUR", // Germany
  ES: "EUR", // Spain
  IT: "EUR", // Italy
  NL: "EUR", // Netherlands
  BE: "EUR", // Belgium
  PT: "EUR", // Portugal
  GR: "EUR", // Greece
  PL: "EUR", // Poland
  SE: "EUR", // Sweden
  DK: "EUR", // Denmark
  FI: "EUR", // Finland
  IE: "EUR", // Ireland
  AT: "EUR", // Austria
  CH: "CHF", // Switzerland
  NO: "NOK", // Norway
  
  // North America
  US: "USD", // United States
  CA: "CAD", // Canada
};

// Country Name to Currency Mapping
// Based on Flutterwave supported countries
const COUNTRY_CURRENCY_MAP = {
  // African Countries
  nigeria: "NGN",
  ghana: "GHS",
  kenya: "KES",
  "south africa": "ZAR",
  uganda: "UGX",
  tanzania: "TZS",
  rwanda: "RWF",
  zambia: "ZMW",
  cameroon: "XAF",
  "ivory coast": "XOF",
  "côte d'ivoire": "XOF",
  senegal: "XOF",
  malawi: "MWK",
  mauritius: "MUR",
  egypt: "EGP",
  mozambique: "MZN",
  
  // European Countries
  "united kingdom": "GBP",
  uk: "GBP",
  "great britain": "GBP",
  // Rest of Europe defaults to EUR
  france: "EUR",
  germany: "EUR",
  spain: "EUR",
  italy: "EUR",
  netherlands: "EUR",
  belgium: "EUR",
  portugal: "EUR",
  greece: "EUR",
  poland: "EUR",
  sweden: "EUR",
  denmark: "EUR",
  finland: "EUR",
  ireland: "EUR",
  austria: "EUR",
  switzerland: "CHF",
  norway: "NOK",
  
  // North America
  "united states": "USD",
  usa: "USD",
  "united states of america": "USD",
  canada: "CAD",
  
  // Default for unsupported countries
  default: "USD",
};

/**
 * Get currency code from country name or ISO code
 * @param {string} country - Country name (case-insensitive) or ISO country code (e.g., 'NG', 'GH', 'KE')
 * @returns {string} Currency code (e.g., 'NGN', 'USD', 'GBP')
 */
export function getCurrencyFromCountry(country) {
  if (!country) return "USD";
  
  const normalizedCountry = country.trim();
  const upperCountry = normalizedCountry.toUpperCase();
  const lowerCountry = normalizedCountry.toLowerCase();
  
  // First, check if it's an ISO country code (2 letters, uppercase)
  if (normalizedCountry.length === 2 && /^[A-Z]{2}$/i.test(normalizedCountry)) {
    if (ISO_COUNTRY_CURRENCY_MAP[upperCountry]) {
      return ISO_COUNTRY_CURRENCY_MAP[upperCountry];
    }
  }
  
  // Check country name map (direct match)
  if (COUNTRY_CURRENCY_MAP[lowerCountry]) {
    return COUNTRY_CURRENCY_MAP[lowerCountry];
  }
  
  // Check for partial matches (e.g., "United States" contains "united states")
  for (const [key, currency] of Object.entries(COUNTRY_CURRENCY_MAP)) {
    if (key === "default") continue; // Skip default entry
    if (lowerCountry.includes(key) || key.includes(lowerCountry)) {
      return currency;
    }
  }
  
  // Check if it's a European country (not explicitly listed)
  const europeanCountries = [
    "albania", "andorra", "armenia", "azerbaijan", "belarus", "bosnia",
    "bulgaria", "croatia", "cyprus", "czech", "estonia", "georgia",
    "hungary", "iceland", "latvia", "liechtenstein", "lithuania",
    "luxembourg", "malta", "moldova", "monaco", "montenegro",
    "north macedonia", "romania", "russia", "san marino", "serbia",
    "slovakia", "slovenia", "ukraine", "vatican"
  ];
  
  if (europeanCountries.some(eu => lowerCountry.includes(eu))) {
    return "EUR";
  }
  
  // Default to USD for unsupported countries
  return COUNTRY_CURRENCY_MAP.default;
}

/**
 * Get all supported currencies
 * @returns {Array<string>} Array of currency codes
 */
export function getSupportedCurrencies() {
  const currencies = new Set(Object.values(COUNTRY_CURRENCY_MAP));
  return Array.from(currencies).sort();
}

/**
 * Check if currency is supported by Flutterwave
 * @param {string} currency - Currency code
 * @returns {boolean} True if supported
 */
export function isCurrencySupported(currency) {
  if (!currency) return false;
  const supported = getSupportedCurrencies();
  return supported.includes(currency.toUpperCase());
}

/**
 * Normalize currency code (uppercase, trim)
 * @param {string} currency - Currency code
 * @returns {string} Normalized currency code
 */
export function normalizeCurrency(currency) {
  if (!currency) return "USD";
  return currency.toUpperCase().trim();
}

/**
 * Detect currency from user profile or IP (fallback)
 * @param {Object} user - User object with country field
 * @param {string} ipAddress - Optional IP address for geolocation fallback
 * @returns {string} Detected currency code
 */
export function detectUserCurrency(user, ipAddress = null) {
  // Priority 1: User's stored currency
  if (user?.currency) {
    return normalizeCurrency(user.currency);
  }
  
  // Priority 2: User's country
  if (user?.country) {
    return getCurrencyFromCountry(user.country);
  }
  
  // Priority 3: IP geolocation (would need external service)
  // For now, default to USD
  // TODO: Integrate IP geolocation service if needed
  
  return "USD";
}

/**
 * Get currency symbol
 * @param {string} currency - Currency code
 * @returns {string} Currency symbol
 */
export function getCurrencySymbol(currency) {
  const symbols = {
    NGN: "₦",
    USD: "$",
    GBP: "£",
    EUR: "€",
    GHS: "₵",
    KES: "KSh",
    ZAR: "R",
    UGX: "USh",
    TZS: "TSh",
    RWF: "RF",
    ZMW: "ZK",
    XAF: "FCFA",
    XOF: "CFA",
    MWK: "MK",
    MUR: "₨",
    EGP: "E£",
    CAD: "C$",
    CHF: "CHF",
    NOK: "kr",
  };
  
  return symbols[currency?.toUpperCase()] || currency || "$";
}

/**
 * Format amount with currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @param {Object} options - Formatting options
 * @returns {string} Formatted amount string
 */
export function formatCurrency(amount, currency = "USD", options = {}) {
  const {
    showSymbol = true,
    decimals = 2,
    locale = "en-US",
  } = options;
  
  const normalizedCurrency = normalizeCurrency(currency);
  const symbol = getCurrencySymbol(normalizedCurrency);
  
  // Format number
  const formattedAmount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  
  if (showSymbol) {
    // For currencies with prefix symbols
    if (["NGN", "USD", "GBP", "EUR", "GHS", "CAD"].includes(normalizedCurrency)) {
      return `${symbol}${formattedAmount}`;
    }
    // For currencies with suffix symbols
    return `${formattedAmount} ${symbol}`;
  }
  
  return formattedAmount;
}

