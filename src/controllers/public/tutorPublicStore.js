/**
 * Public Tutor/Org Store - get all products by storefront slug
 * GET /api/marketplace/public/tutor/:slug/products
 *
 * Resolves sole tutors first, then organizations (same URL namespace).
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { Courses } from "../../models/course/courses.js";
import { EBooks } from "../../models/marketplace/ebooks.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { Community } from "../../models/marketplace/community.js";
import { Membership } from "../../models/marketplace/membership.js";
import { Op } from "sequelize";

/**
 * GET /api/marketplace/public/tutor/:slug/products
 */
export const getTutorProductsBySlug = TryCatchFunction(async (req, res) => {
  const { slug } = req.params;

  if (!slug || !slug.trim()) {
    throw new ErrorClass("Tutor slug is required", 400);
  }

  const normalizedSlug = slug.trim().toLowerCase();

  const tutor = await SoleTutor.findOne({
    where: {
      slug: normalizedSlug,
      status: "active",
    },
    attributes: [
      "id",
      "fname",
      "lname",
      "mname",
      "slug",
      "profile_image",
      "bio",
      "specialization",
      "rating",
      "total_reviews",
    ],
  });

  let ownerType;
  let ownerId;
  let storefront;

  if (tutor) {
    ownerType = "sole_tutor";
    ownerId = tutor.id;
    const displayName = tutor.mname
      ? `${tutor.fname} ${tutor.mname} ${tutor.lname}`.trim()
      : `${tutor.fname} ${tutor.lname}`.trim();
    storefront = {
      id: tutor.id,
      slug: tutor.slug,
      name: displayName,
      profile_image: tutor.profile_image,
      bio: tutor.bio,
      specialization: tutor.specialization,
      rating: tutor.rating ? parseFloat(tutor.rating) : null,
      total_reviews: tutor.total_reviews || 0,
      owner_type: "sole_tutor",
    };
  } else {
    const org = await Organization.findOne({
      where: {
        slug: normalizedSlug,
        status: "active",
      },
      attributes: [
        "id",
        "name",
        "slug",
        "logo",
        "description",
        "rating",
        "total_reviews",
      ],
    });

    if (!org) {
      throw new ErrorClass("Tutor not found", 404);
    }

    ownerType = "organization";
    ownerId = org.id;
    storefront = {
      id: org.id,
      slug: org.slug,
      name: org.name,
      profile_image: org.logo,
      bio: org.description,
      specialization: null,
      rating: org.rating ? parseFloat(org.rating) : null,
      total_reviews: org.total_reviews || 0,
      owner_type: "organization",
    };
  }

  const [courses, ebooks, digitalDownloads, communities, memberships] =
    await Promise.all([
      Courses.findAll({
        where: {
          owner_id: ownerId,
          owner_type: ownerType,
          is_marketplace: true,
          marketplace_status: "published",
          [Op.or]: [{ deleted_at: null }, { deleted_at: { [Op.is]: null } }],
        },
        attributes: [
          "id",
          "title",
          "description",
          "price",
          "currency",
          "image_url",
          "category",
          "slug",
          "duration_days",
          "owner_type",
          "owner_id",
        ],
        order: [["id", "DESC"]],
      }),
      EBooks.findAll({
        where: {
          owner_id: ownerId,
          owner_type: ownerType,
          status: "published",
        },
        attributes: [
          "id",
          "title",
          "description",
          "author",
          "price",
          "currency",
          "cover_image",
          "category",
          "slug",
          "pages",
          "owner_type",
          "owner_id",
        ],
        order: [["id", "DESC"]],
      }),
      DigitalDownloads.findAll({
        where: {
          owner_id: ownerId,
          owner_type: ownerType,
          status: "published",
        },
        attributes: [
          "id",
          "title",
          "description",
          "price",
          "currency",
          "cover_image",
          "category",
          "slug",
          "owner_type",
          "owner_id",
        ],
        order: [["id", "DESC"]],
      }),
      Community.findAll({
        where: {
          tutor_id: ownerId,
          tutor_type: ownerType,
          status: "published",
          visibility: "public",
        },
        attributes: [
          "id",
          "name",
          "description",
          "price",
          "currency",
          "image_url",
          "category",
          "slug",
          "member_count",
          "tutor_id",
          "tutor_type",
        ],
        order: [["id", "DESC"]],
      }),
      Membership.findAll({
        where: {
          tutor_id: ownerId,
          tutor_type: ownerType,
          status: "active",
        },
        attributes: [
          "id",
          "name",
          "description",
          "price",
          "currency",
          "image_url",
          "category",
          "slug",
          "pricing_type",
          "tutor_id",
          "tutor_type",
        ],
        order: [["id", "DESC"]],
      }),
    ]);

  const formatProduct = (p, type) => {
    const base = {
      id: p.id,
      type,
      title: p.title || p.name,
      description: p.description,
      price: parseFloat(p.price || 0),
      currency: p.currency || "NGN",
      image_url: p.image_url || p.cover_image,
      category: p.category,
      slug: p.slug,
    };
    if (type === "course") base.duration_days = p.duration_days;
    if (type === "ebook") base.pages = p.pages;
    if (type === "community") base.member_count = p.member_count;
    if (type === "membership") base.pricing_type = p.pricing_type;
    return base;
  };

  const products = [
    ...courses.map((p) => formatProduct(p, "course")),
    ...ebooks.map((p) => formatProduct(p, "ebook")),
    ...digitalDownloads.map((p) => formatProduct(p, "digital_download")),
    ...communities.map((p) => formatProduct(p, "community")),
    ...memberships.map((p) => formatProduct(p, "membership")),
  ];

  res.status(200).json({
    success: true,
    message: "Tutor and products retrieved successfully",
    data: {
      tutor: storefront,
      products,
      meta: {
        total: products.length,
        courses: courses.length,
        ebooks: ebooks.length,
        digital_downloads: digitalDownloads.length,
        communities: communities.length,
        memberships: memberships.length,
      },
    },
  });
});
