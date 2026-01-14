/**
 * Slug Generator Utility
 * Generates URL-friendly slugs from product titles/names
 */

/**
 * Generate a URL-friendly slug from a string
 * @param {string} text - Text to convert to slug
 * @returns {string} URL-friendly slug
 */
export function generateSlug(text) {
  if (!text) {
    return "";
  }

  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^\w\-]+/g, "") // Remove non-word characters except hyphens
    .replace(/\-\-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+/, "") // Remove leading hyphens
    .replace(/-+$/, ""); // Remove trailing hyphens
}

/**
 * Generate a unique slug by appending a number if needed
 * @param {string} baseSlug - Base slug to make unique
 * @param {Function} checkExists - Async function that checks if slug exists (returns boolean)
 * @returns {Promise<string>} Unique slug
 */
export async function generateUniqueSlug(baseSlug, checkExists) {
  let slug = baseSlug;
  let counter = 1;

  // Check if base slug exists
  const exists = await checkExists(slug);
  if (!exists) {
    return slug;
  }

  // Append number until we find a unique slug
  while (true) {
    const newSlug = `${baseSlug}-${counter}`;
    const slugExists = await checkExists(newSlug);
    if (!slugExists) {
      return newSlug;
    }
    counter++;
  }
}

/**
 * Generate slug from product title/name
 * @param {string} title - Product title or name
 * @param {Function} checkExists - Async function to check if slug exists
 * @returns {Promise<string>} Unique slug
 */
export async function generateProductSlug(title, checkExists) {
  const baseSlug = generateSlug(title);
  if (!baseSlug) {
    // Fallback to timestamp if title is empty
    return `product-${Date.now()}`;
  }
  return await generateUniqueSlug(baseSlug, checkExists);
}
