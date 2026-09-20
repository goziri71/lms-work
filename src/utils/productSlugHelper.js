/**
 * Product Slug Helper
 * Generates unique slugs for products
 */

import { generateSlug, generateUniqueSlug } from "./slugGenerator.js";
import { Op } from "sequelize";
import { Courses } from "../models/course/courses.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";
import { EBooks } from "../models/marketplace/ebooks.js";
import { DigitalDownloads } from "../models/marketplace/digitalDownloads.js";
import { Community } from "../models/marketplace/community.js";
import { Membership } from "../models/marketplace/membership.js";

async function storefrontSlugTaken(slug, { excludeTutorId = null, excludeOrgId = null } = {}) {
  const tutorWhere = { slug };
  if (excludeTutorId) tutorWhere.id = { [Op.ne]: excludeTutorId };
  const orgWhere = { slug };
  if (excludeOrgId) orgWhere.id = { [Op.ne]: excludeOrgId };

  const [tutor, org] = await Promise.all([
    SoleTutor.findOne({ where: tutorWhere, attributes: ["id"] }),
    Organization.findOne({ where: orgWhere, attributes: ["id"] }),
  ]);
  return !!(tutor || org);
}

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

/**
 * Generate unique slug for a sole tutor (from fname + lname)
 */
export async function generateTutorSlug(fname, lname, excludeId = null) {
  const name = [fname, lname].filter(Boolean).join(" ").trim();
  const baseSlug = generateSlug(name);
  if (!baseSlug) {
    return `tutor-${excludeId || Date.now()}`;
  }

  return await generateUniqueSlug(baseSlug, async (slug) =>
    storefrontSlugTaken(slug, { excludeTutorId: excludeId })
  );
}

/**
 * Generate unique slug for an organization (from name)
 */
export async function generateOrganizationSlug(name, excludeId = null) {
  const baseSlug = generateSlug(name);
  if (!baseSlug) {
    return `org-${excludeId || Date.now()}`;
  }

  return await generateUniqueSlug(baseSlug, async (slug) =>
    storefrontSlugTaken(slug, { excludeOrgId: excludeId })
  );
}
