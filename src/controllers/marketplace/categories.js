/**
 * Categories Controller
 * Provides category list for frontend
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { CATEGORIES } from "../../constants/categories.js";

/**
 * Get all available categories
 * GET /api/marketplace/categories
 */
export const getCategories = TryCatchFunction(async (req, res) => {
  res.json({
    success: true,
    data: {
      categories: CATEGORIES,
    },
  });
});

