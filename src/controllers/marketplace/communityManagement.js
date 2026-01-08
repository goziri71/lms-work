/**
 * Community Management Controller
 * Handles CRUD operations for communities by tutors
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Community } from "../../models/marketplace/community.js";
import { checkSubscriptionLimit } from "./tutorSubscription.js";
import { supabase } from "../../utils/supabase.js";
import multer from "multer";
import { Op } from "sequelize";
import { normalizeCategory } from "../../constants/categories.js";

// Configure multer for community image uploads
const uploadCommunityImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ErrorClass("Only JPEG, PNG, and WebP images are allowed", 400), false);
    }
  },
});

export const uploadCommunityImageMiddleware = uploadCommunityImage.single("image");

/**
 * Helper to get tutor info
 */
function getTutorInfo(req) {
  const userType = req.user.userType;
  let tutorId, tutorType;

  if (userType === "sole_tutor") {
    tutorId = req.tutor.id;
    tutorType = "sole_tutor";
  } else if (userType === "organization") {
    tutorId = req.tutor.id;
    tutorType = "organization";
  } else if (userType === "organization_user") {
    tutorId = req.tutor.organization_id;
    tutorType = "organization";
  } else {
    throw new ErrorClass("Invalid user type", 403);
  }

  return { tutorId, tutorType };
}


/**
 * Create a new community
 * POST /api/marketplace/tutor/communities
 */
export const createCommunity = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);

  // Check subscription limits
  const limitCheck = await checkSubscriptionLimit(tutorId, tutorType, "community");
  if (!limitCheck.allowed) {
    throw new ErrorClass(limitCheck.reason, 403);
  }

  const {
    name,
    description,
    category,
    price,
    currency = "NGN",
    trial_days = 0,
    member_limit,
    auto_approve = true,
    who_can_post = "members",
    moderation_enabled = false,
    file_sharing_enabled = true,
    live_sessions_enabled = true,
    visibility = "public",
  } = req.body;

  if (!name || !price) {
    throw new ErrorClass("Name and price are required", 400);
  }

  // Upload image if provided
  let imageUrl = null;
  if (req.file) {
    const bucket = process.env.COMMUNITIES_BUCKET || "communities";
    
    // Check if bucket exists, create if it doesn't
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (!listError) {
        const bucketExists = buckets?.some((b) => b.name === bucket);
        if (!bucketExists) {
          // Try to create the bucket
          const { error: createError } = await supabase.storage.createBucket(bucket, {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          });
          if (createError) {
            console.error(`Failed to create bucket "${bucket}":`, createError.message);
            throw new ErrorClass(
              `Storage bucket "${bucket}" does not exist. Please create it in Supabase Storage settings. Error: ${createError.message}`,
              500
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof ErrorClass) {
        throw error;
      }
      // If bucket check fails, continue and let upload error handle it
      console.warn("Could not verify bucket existence:", error.message);
    }

    const fileExt = req.file.originalname.split(".").pop();
    const fileName = `communities/${tutorId}_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      if (error.message?.includes("Bucket not found") || error.message?.includes("not found")) {
        throw new ErrorClass(
          `Storage bucket "${bucket}" does not exist. Please create a bucket named "${bucket}" in your Supabase Storage settings.`,
          500
        );
      }
      throw new ErrorClass(`Image upload failed: ${error.message}`, 500);
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    imageUrl = urlData.publicUrl;
  }

  const community = await Community.create({
    tutor_id: tutorId,
    tutor_type: tutorType,
    name,
    description,
    category: normalizeCategory(category),
    image_url: imageUrl,
    price: parseFloat(price),
    currency,
    trial_days: parseInt(trial_days) || 0,
    member_limit: member_limit ? parseInt(member_limit) : null,
    auto_approve: auto_approve === true || auto_approve === "true",
    who_can_post,
    moderation_enabled: moderation_enabled === true || moderation_enabled === "true",
    file_sharing_enabled: file_sharing_enabled !== false && file_sharing_enabled !== "false",
    live_sessions_enabled: live_sessions_enabled !== false && live_sessions_enabled !== "false",
    visibility,
    status: "draft",
    commission_rate: 0, // No commission for communities
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "Community created successfully",
    data: community,
  });
});

/**
 * Get all communities for tutor
 * GET /api/marketplace/tutor/communities
 */
export const getMyCommunities = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { page = 1, limit = 20, status, search } = req.query;

  const where = {
    tutor_id: tutorId,
    tutor_type: tutorType,
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows: communities } = await Community.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["created_at", "DESC"]],
  });

  res.json({
    status: true,
    code: 200,
    message: "Communities retrieved successfully",
    data: {
      communities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

/**
 * Get single community
 * GET /api/marketplace/tutor/communities/:id
 */
export const getCommunity = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const community = await Community.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  res.json({
    status: true,
    code: 200,
    message: "Community retrieved successfully",
    data: community,
  });
});

/**
 * Update community
 * PUT /api/marketplace/tutor/communities/:id
 */
export const updateCommunity = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const community = await Community.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  const {
    name,
    description,
    category,
    price,
    currency,
    trial_days,
    member_limit,
    auto_approve,
    who_can_post,
    moderation_enabled,
    file_sharing_enabled,
    live_sessions_enabled,
    visibility,
  } = req.body;

  // Upload new image if provided
  if (req.file) {
    const bucket = process.env.COMMUNITIES_BUCKET || "communities";
    
    // Check if bucket exists, create if it doesn't
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (!listError) {
        const bucketExists = buckets?.some((b) => b.name === bucket);
        if (!bucketExists) {
          // Try to create the bucket
          const { error: createError } = await supabase.storage.createBucket(bucket, {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          });
          if (createError) {
            console.error(`Failed to create bucket "${bucket}":`, createError.message);
            throw new ErrorClass(
              `Storage bucket "${bucket}" does not exist. Please create it in Supabase Storage settings. Error: ${createError.message}`,
              500
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof ErrorClass) {
        throw error;
      }
      // If bucket check fails, continue and let upload error handle it
      console.warn("Could not verify bucket existence:", error.message);
    }

    // Delete old image if exists
    if (community.image_url) {
      try {
        const urlParts = community.image_url.split("/");
        const fileName = urlParts[urlParts.length - 1];
        await supabase.storage.from(bucket).remove([`communities/${fileName}`]);
      } catch (error) {
        console.error("Error deleting old image:", error);
      }
    }

    const fileExt = req.file.originalname.split(".").pop();
    const fileName = `communities/${tutorId}_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      if (error.message?.includes("Bucket not found") || error.message?.includes("not found")) {
        throw new ErrorClass(
          `Storage bucket "${bucket}" does not exist. Please create a bucket named "${bucket}" in your Supabase Storage settings.`,
          500
        );
      }
      throw new ErrorClass(`Image upload failed: ${error.message}`, 500);
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    community.image_url = urlData.publicUrl;
  }

  // Update fields
  if (name !== undefined) community.name = name;
  if (description !== undefined) community.description = description;
  if (category !== undefined) community.category = normalizeCategory(category);
  if (price !== undefined) community.price = parseFloat(price);
  if (currency !== undefined) community.currency = currency;
  if (trial_days !== undefined) community.trial_days = parseInt(trial_days) || 0;
  if (member_limit !== undefined) community.member_limit = member_limit ? parseInt(member_limit) : null;
  if (auto_approve !== undefined) community.auto_approve = auto_approve === true || auto_approve === "true";
  if (who_can_post !== undefined) community.who_can_post = who_can_post;
  if (moderation_enabled !== undefined) community.moderation_enabled = moderation_enabled === true || moderation_enabled === "true";
  if (file_sharing_enabled !== undefined) community.file_sharing_enabled = file_sharing_enabled !== false && file_sharing_enabled !== "false";
  if (live_sessions_enabled !== undefined) community.live_sessions_enabled = live_sessions_enabled !== false && live_sessions_enabled !== "false";
  if (visibility !== undefined) community.visibility = visibility;
  // Commission rate is always 0 for communities (no commission)
  community.commission_rate = 0;

  await community.save();

  res.json({
    status: true,
    code: 200,
    message: "Community updated successfully",
    data: community,
  });
});

/**
 * Delete community
 * DELETE /api/marketplace/tutor/communities/:id
 */
export const deleteCommunity = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const community = await Community.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  // Delete image if exists
  if (community.image_url) {
    try {
      const urlParts = community.image_url.split("/");
      const fileName = urlParts[urlParts.length - 1];
      const bucket = process.env.COMMUNITIES_BUCKET || "communities";
      await supabase.storage.from(bucket).remove([`communities/${fileName}`]);
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  }

  await community.destroy();

  res.json({
    status: true,
    code: 200,
    message: "Community deleted successfully",
  });
});

