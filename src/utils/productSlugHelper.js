/**
 * Product Slug Helper
 * Generates unique slugs for products
 */

import { generateSlug, generateUniqueSlug } from "./slugGenerator.js";
import { Op } from "sequelize";
import { Courses } from "../models/course/courses.js";
import { EBooks } from "../models/marketplace/ebooks.js";
import { DigitalDownloads } from "../models/marketplace/digitalDownloads.js";
import { Community } from "../models/marketplace/community.js";
import { Membership } from "../models/marketplace/membership.js";

/**
 * Generate unique slug for a course
 */
export async function generateCourseSlug(title, excludeId = null) {
  const baseSlug = generateSlug(title);
  if (!baseSlug) {
    return `course-${Date.now()}`;
  }

  return await generateUniqueSlug(baseSlug, async (slug) => {
    const where = { slug };
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }
    const existing = await Courses.findOne({ where });
    return !!existing;
  });
}

/**
 * Generate unique slug for an ebook
 */
export async function generateEbookSlug(title, excludeId = null) {
  const baseSlug = generateSlug(title);
  if (!baseSlug) {
    return `ebook-${Date.now()}`;
  }

  return await generateUniqueSlug(baseSlug, async (slug) => {
    const where = { slug };
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }
    const existing = await EBooks.findOne({ where });
    return !!existing;
  });
}

/**
 * Generate unique slug for a digital download
 */
export async function generateDigitalDownloadSlug(title, excludeId = null) {
  const baseSlug = generateSlug(title);
  if (!baseSlug) {
    return `digital-download-${Date.now()}`;
  }

  return await generateUniqueSlug(baseSlug, async (slug) => {
    const where = { slug };
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }
    const existing = await DigitalDownloads.findOne({ where });
    return !!existing;
  });
}

/**
 * Generate unique slug for a community
 */
export async function generateCommunitySlug(name, excludeId = null) {
  const baseSlug = generateSlug(name);
  if (!baseSlug) {
    return `community-${Date.now()}`;
  }

  return await generateUniqueSlug(baseSlug, async (slug) => {
    const where = { slug };
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }
    const existing = await Community.findOne({ where });
    return !!existing;
  });
}

/**
 * Generate unique slug for a membership
 */
export async function generateMembershipSlug(name, excludeId = null) {
  const baseSlug = generateSlug(name);
  if (!baseSlug) {
    return `membership-${Date.now()}`;
  }

  return await generateUniqueSlug(baseSlug, async (slug) => {
    const where = { slug };
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }
    const existing = await Membership.findOne({ where });
    return !!existing;
  });
}
