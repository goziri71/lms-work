/**
 * Pagination helper utilities
 */

/**
 * Extract pagination parameters from request
 * @param {Object} req - Express request object
 * @returns {Object} - Pagination parameters
 */
export const getPaginationParams = (req) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100); // Max 100 items per page
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Build pagination metadata
 * @param {number} total - Total count of items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} - Pagination metadata
 */
export const getPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    hasPreviousPage,
  };
};

/**
 * Format paginated response
 * @param {Array} data - Data array
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {string} message - Success message
 * @returns {Object} - Formatted response
 */
export const paginatedResponse = (data, total, page, limit, message = "Data retrieved successfully") => {
  return {
    status: true,
    code: 200,
    message,
    data,
    pagination: getPaginationMeta(total, page, limit),
  };
};

