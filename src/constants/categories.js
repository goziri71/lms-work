/**
 * Shared Categories for Marketplace Products
 * Used by Courses, Digital Downloads, Coaching Sessions, and Communities
 */

export const CATEGORIES = [
  "Business & Management",
  "Technology & Data",
  "Engineering & Physical Science",
  "Health & Medicine",
  "Arts & Humanities",
  "Personal Development & Education",
];

/**
 * Normalize category input (case-insensitive matching)
 * @param {string} category - Category string
 * @returns {string|null} Normalized category or null if invalid
 */
export function normalizeCategory(category) {
  if (!category) return null;
  
  const normalized = category.trim();
  
  // Direct match (case-sensitive)
  if (CATEGORIES.includes(normalized)) {
    return normalized;
  }
  
  // Case-insensitive match
  const lowerNormalized = normalized.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.toLowerCase() === lowerNormalized) {
      return cat;
    }
  }
  
  // Partial match (for flexibility)
  const categoryMap = {
    "business": "Business & Management",
    "management": "Business & Management",
    "tech": "Technology & Data",
    "technology": "Technology & Data",
    "data": "Technology & Data",
    "engineering": "Engineering & Physical Science",
    "science": "Engineering & Physical Science",
    "health": "Health & Medicine",
    "medicine": "Health & Medicine",
    "arts": "Arts & Humanities",
    "humanities": "Arts & Humanities",
    "personal development": "Personal Development & Education",
    "education": "Personal Development & Education",
    "development": "Personal Development & Education",
  };
  
  const lowerInput = lowerNormalized;
  for (const [key, value] of Object.entries(categoryMap)) {
    if (lowerInput.includes(key) || key.includes(lowerInput)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Validate category
 * @param {string} category - Category to validate
 * @returns {boolean} True if valid
 */
export function isValidCategory(category) {
  return normalizeCategory(category) !== null;
}

