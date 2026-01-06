/**
 * Community Content Controller
 * Handles posts, comments, and file sharing for communities
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Community } from "../../models/marketplace/community.js";
import { CommunityMember } from "../../models/marketplace/communityMember.js";
import { CommunityPost } from "../../models/marketplace/communityPost.js";
import { CommunityComment } from "../../models/marketplace/communityComment.js";
import { CommunityFile } from "../../models/marketplace/communityFile.js";
import { Students } from "../../models/auth/student.js";
import { supabase } from "../../utils/supabase.js";
import multer from "multer";
import { Op } from "sequelize";

// Configure multer for file uploads
const uploadCommunityFile = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

export const uploadCommunityFileMiddleware = uploadCommunityFile.single("file");

// Configure multer for post image uploads
const uploadPostImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for post images
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ErrorClass("Only JPEG, PNG, WebP, and GIF images are allowed", 400),
        false
      );
    }
  },
});

export const uploadPostImageMiddleware = uploadPostImage.single("image");

/**
 * Helper to check if user has access to community
 * Checks both student membership and tutor ownership
 */
async function checkCommunityAccess(communityId, userId, userType, req = null) {
  // First, check if user is the community owner (tutor)
  if (
    userType === "sole_tutor" ||
    userType === "organization" ||
    userType === "organization_user"
  ) {
    const community = await Community.findByPk(communityId);
    if (!community) {
      throw new ErrorClass("Community not found", 404);
    }

    // Get tutor info from request
    // Try req.tutor first (if tutorAuthorize was used), otherwise use req.user.id
    let tutorId, tutorType;
    if (userType === "sole_tutor") {
      tutorId = req?.tutor?.id || userId;
      tutorType = "sole_tutor";
    } else if (userType === "organization") {
      tutorId = req?.tutor?.id || userId;
      tutorType = "organization";
    } else if (userType === "organization_user") {
      // For organization_user, we need to get the organization_id
      if (req?.tutor?.organization_id) {
        tutorId = req.tutor.organization_id;
      } else if (req?.user?.organizationId) {
        // Check if organizationId is in req.user (from JWT token)
        tutorId = req.user.organizationId;
      } else {
        // Fetch organization_id from database if not in req.tutor or req.user
        const { OrganizationUser } = await import(
          "../../models/marketplace/organizationUser.js"
        );
        const orgUser = await OrganizationUser.findByPk(userId, {
          attributes: ["organization_id"],
        });
        tutorId = orgUser?.organization_id;
      }
      tutorType = "organization";
    }

    // Convert IDs to numbers for comparison (in case one is string and other is number)
    const communityTutorId = Number(community.tutor_id);
    const userTutorId = Number(tutorId);

    // Check if user is the owner
    if (
      tutorId &&
      tutorType &&
      communityTutorId === userTutorId &&
      community.tutor_type === tutorType
    ) {
      return { isOwner: true, isMember: false };
    }
  }

  // If not owner, check if user is an active member (for students)
  if (userType === "student") {
    const member = await CommunityMember.findOne({
      where: {
        community_id: communityId,
        student_id: userId,
        status: "active",
        subscription_status: "active",
      },
    });

    if (member) {
      return { isOwner: false, isMember: true, member };
    }
  }

  // No access
  throw new ErrorClass("You do not have active access to this community", 403);
}

/**
 * Create a post in community
 * POST /api/marketplace/communities/:id/posts
 */
export const createPost = TryCatchFunction(async (req, res) => {
  const { id: communityId } = req.params;
  const userId = req.user?.id;
  const userType = req.user?.userType;

  // Check access (allows both students and tutors)
  const access = await checkCommunityAccess(communityId, userId, userType, req);

  // Get community
  const community = await Community.findByPk(communityId);
  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  // Check who can post
  if (community.who_can_post === "tutor_only" && !access.isOwner) {
    throw new ErrorClass(
      "Only the tutor can create posts in this community",
      403
    );
  }

  if (
    community.who_can_post === "members" &&
    !access.isMember &&
    !access.isOwner
  ) {
    throw new ErrorClass(
      "Only members can create posts in this community",
      403
    );
  }

  const { title, content, content_type = "text", category, tags } = req.body;

  if (!content) {
    throw new ErrorClass("Post content is required", 400);
  }

  // Upload image if provided
  let imageUrl = null;
  if (req.file) {
    const fileExt = req.file.originalname.split(".").pop();
    const fileName = `communities/${communityId}/posts/${userId}_${Date.now()}.${fileExt}`;
    const bucket = process.env.COMMUNITIES_BUCKET || "communities";

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new ErrorClass(`Image upload failed: ${error.message}`, 500);
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    imageUrl = urlData.publicUrl;
  }

  // Determine author ID - for tutors, use their ID; for students, use student ID
  const authorId = userId;

  const post = await CommunityPost.create({
    community_id: communityId,
    author_id: authorId,
    title: title || null,
    content,
    content_type,
    category: category || null,
    tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : null,
    image_url: imageUrl,
    status: "published",
  });

  // Increment post count
  await community.increment("post_count");

  // Get author info - handle both students and tutors
  let author, authorName;
  if (access.isOwner) {
    // For tutors, get tutor info
    if (userType === "sole_tutor") {
      // Try req.tutor first, otherwise fetch from database
      if (req?.tutor) {
        author = {
          id: req.tutor.id,
          name:
            `${req.tutor.fname || ""} ${req.tutor.lname || ""}`.trim() ||
            req.tutor.email,
          email: req.tutor.email,
        };
      } else {
        // Fetch from database
        const { SoleTutor } = await import(
          "../../models/marketplace/soleTutor.js"
        );
        const tutor = await SoleTutor.findByPk(userId, {
          attributes: ["id", "fname", "lname", "email"],
        });
        if (tutor) {
          author = {
            id: tutor.id,
            name:
              `${tutor.fname || ""} ${tutor.lname || ""}`.trim() || tutor.email,
            email: tutor.email,
          };
        }
      }
    } else if (
      userType === "organization" ||
      userType === "organization_user"
    ) {
      // Try req.tutor first, otherwise fetch from database
      if (req?.tutor) {
        author = {
          id: req.tutor.organization_id || req.tutor.id,
          name:
            req.tutor.organization?.name || req.tutor.name || req.tutor.email,
          email: req.tutor.email,
        };
      } else {
        // Fetch from database
        const { Organization } = await import(
          "../../models/marketplace/organization.js"
        );
        const { OrganizationUser } = await import(
          "../../models/marketplace/organizationUser.js"
        );

        if (userType === "organization") {
          const org = await Organization.findByPk(userId, {
            attributes: ["id", "name", "email"],
          });
          if (org) {
            author = {
              id: org.id,
              name: org.name || org.email,
              email: org.email,
            };
          }
        } else {
          // organization_user
          const orgUser = await OrganizationUser.findByPk(userId, {
            attributes: ["id", "organization_id", "fname", "lname", "email"],
            include: [
              {
                model: Organization,
                as: "organization",
                attributes: ["id", "name"],
                required: false,
              },
            ],
          });
          if (orgUser) {
            author = {
              id: orgUser.organization_id || orgUser.id,
              name:
                orgUser.organization?.name ||
                `${orgUser.fname || ""} ${orgUser.lname || ""}`.trim() ||
                orgUser.email,
              email: orgUser.email,
            };
          }
        }
      }
    }
    authorName = author?.name || "Unknown";
  } else {
    // For students
    const student = await Students.findByPk(authorId, {
      attributes: ["id", "fname", "lname", "mname", "email"],
    });
    if (student) {
      authorName =
        `${student.fname || ""} ${student.mname || ""} ${
          student.lname || ""
        }`.trim() || student.email;
      author = {
        id: student.id,
        name: authorName,
        email: student.email,
      };
    }
  }

  // Fallback if author not found
  if (!author) {
    author = {
      id: userId,
      name: "Unknown",
      email: "",
    };
    authorName = "Unknown";
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: "Post created successfully",
    data: {
      ...post.toJSON(),
      author: {
        id: author.id,
        name: authorName,
        email: author.email,
      },
    },
  });
});

/**
 * Get posts in community
 * GET /api/marketplace/communities/:id/posts
 */
export const getPosts = TryCatchFunction(async (req, res) => {
  const { id: communityId } = req.params;
  const {
    page = 1,
    limit = 20,
    category,
    search,
    status = "published",
  } = req.query;
  const userId = req.user?.id;
  const userType = req.user?.userType;

  // Check if user has access (optional auth for public browsing)
  if (userId) {
    try {
      await checkCommunityAccess(communityId, userId, userType, req);
    } catch (error) {
      // If no access, still allow viewing published posts (public browsing)
    }
  }

  const where = {
    community_id: communityId,
    status,
  };

  if (category) {
    where.category = category;
  }

  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { content: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows: posts } = await CommunityPost.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["created_at", "DESC"]],
    include: [
      {
        model: Students,
        as: "author",
        attributes: ["id", "fname", "lname", "mname", "email"],
      },
    ],
  });

  // Format posts with author names
  const formattedPosts = posts.map((post) => {
    const author = post.author;
    const authorName =
      `${author.fname || ""} ${author.mname || ""} ${
        author.lname || ""
      }`.trim() || author.email;

    return {
      ...post.toJSON(),
      author: {
        id: author.id,
        name: authorName,
        email: author.email,
      },
    };
  });

  res.json({
    status: true,
    code: 200,
    message: "Posts retrieved successfully",
    data: {
      posts: formattedPosts,
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
 * Get single post
 * GET /api/marketplace/communities/:id/posts/:postId
 */
export const getPost = TryCatchFunction(async (req, res) => {
  const { id: communityId, postId } = req.params;
  const userId = req.user?.id;
  const userType = req.user?.userType;

  // Check access
  if (userId) {
    try {
      await checkCommunityAccess(communityId, userId, userType, req);
    } catch (error) {
      // Allow viewing published posts even without active subscription
    }
  }

  const post = await CommunityPost.findOne({
    where: {
      id: postId,
      community_id: communityId,
      status: "published",
    },
    include: [
      {
        model: Students,
        as: "author",
        attributes: ["id", "fname", "lname", "mname", "email"],
      },
    ],
  });

  if (!post) {
    throw new ErrorClass("Post not found", 404);
  }

  // Increment views
  await post.increment("views");

  const author = post.author;
  const authorName =
    `${author.fname || ""} ${author.mname || ""} ${
      author.lname || ""
    }`.trim() || author.email;

  res.json({
    status: true,
    code: 200,
    message: "Post retrieved successfully",
    data: {
      ...post.toJSON(),
      author: {
        id: author.id,
        name: authorName,
        email: author.email,
      },
    },
  });
});

/**
 * Update post
 * PUT /api/marketplace/communities/:id/posts/:postId
 */
export const updatePost = TryCatchFunction(async (req, res) => {
  const { id: communityId, postId } = req.params;
  const userId = req.user?.id;
  const userType = req.user?.userType;

  // Check access (allows both students and tutors)
  const access = await checkCommunityAccess(communityId, userId, userType, req);

  const post = await CommunityPost.findOne({
    where: {
      id: postId,
      community_id: communityId,
      author_id: studentId,
    },
  });

  if (!post) {
    throw new ErrorClass(
      "Post not found or you don't have permission to update it",
      404
    );
  }

  const { title, content, content_type, category, tags } = req.body;

  // Handle image upload if provided
  if (req.file) {
    // Delete old image if exists
    if (post.image_url) {
      try {
        const urlParts = post.image_url.split("/");
        const fileName = urlParts
          .slice(urlParts.indexOf("communities"))
          .join("/");
        const bucket = process.env.COMMUNITIES_BUCKET || "communities";
        await supabase.storage.from(bucket).remove([fileName]);
      } catch (error) {
        console.error("Error deleting old image:", error);
      }
    }

    // Upload new image
    const fileExt = req.file.originalname.split(".").pop();
    const fileName = `communities/${communityId}/posts/${userId}_${Date.now()}.${fileExt}`;
    const bucket = process.env.COMMUNITIES_BUCKET || "communities";

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new ErrorClass(`Image upload failed: ${error.message}`, 500);
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    post.image_url = urlData.publicUrl;
  }

  if (title !== undefined) post.title = title;
  if (content !== undefined) post.content = content;
  if (content_type !== undefined) post.content_type = content_type;
  if (category !== undefined) post.category = category;
  if (tags !== undefined)
    post.tags = tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : null;

  await post.save();

  res.json({
    status: true,
    code: 200,
    message: "Post updated successfully",
    data: post,
  });
});

/**
 * Delete post
 * DELETE /api/marketplace/communities/:id/posts/:postId
 */
export const deletePost = TryCatchFunction(async (req, res) => {
  const { id: communityId, postId } = req.params;
  const userId = req.user?.id;
  const userType = req.user?.userType;

  // Check access (allows both students and tutors)
  const access = await checkCommunityAccess(communityId, userId, userType, req);

  // Build where clause - allow tutors to delete any post in their community, students only their own
  const where = {
    id: postId,
    community_id: communityId,
  };

  if (!access.isOwner) {
    // Students can only delete their own posts
    where.author_id = userId;
  }

  const post = await CommunityPost.findOne({ where });

  if (!post) {
    throw new ErrorClass(
      "Post not found or you don't have permission to delete it",
      404
    );
  }

  // Soft delete (mark as deleted)
  await post.update({ status: "deleted" });

  // Decrement post count
  const community = await Community.findByPk(communityId);
  await community.decrement("post_count");

  res.json({
    status: true,
    code: 200,
    message: "Post deleted successfully",
  });
});

/**
 * Create comment on post
 * POST /api/marketplace/communities/:id/posts/:postId/comments
 */
export const createComment = TryCatchFunction(async (req, res) => {
  const { id: communityId, postId } = req.params;
  const userId = req.user?.id;
  const userType = req.user?.userType;

  // Check access (allows both students and tutors)
  await checkCommunityAccess(communityId, userId, userType, req);

  // Verify post exists
  const post = await CommunityPost.findByPk(postId);
  if (!post || post.community_id !== parseInt(communityId)) {
    throw new ErrorClass("Post not found", 404);
  }

  const { content, parent_comment_id } = req.body;

  if (!content) {
    throw new ErrorClass("Comment content is required", 400);
  }

  const comment = await CommunityComment.create({
    post_id: postId,
    author_id: userId,
    parent_comment_id: parent_comment_id || null,
    content,
    status: "published",
  });

  // Increment comment count
  await post.increment("comments_count");

  // Get author info - handle both students and tutors
  let author, authorName;
  if (
    userType === "sole_tutor" ||
    userType === "organization" ||
    userType === "organization_user"
  ) {
    // For tutors
    if (userType === "sole_tutor") {
      // Try req.tutor first, otherwise fetch from database
      if (req?.tutor) {
        author = {
          id: req.tutor.id,
          name:
            `${req.tutor.fname || ""} ${req.tutor.lname || ""}`.trim() ||
            req.tutor.email,
          email: req.tutor.email,
        };
      } else {
        // Fetch from database
        const { SoleTutor } = await import(
          "../../models/marketplace/soleTutor.js"
        );
        const tutor = await SoleTutor.findByPk(userId, {
          attributes: ["id", "fname", "lname", "email"],
        });
        if (tutor) {
          author = {
            id: tutor.id,
            name:
              `${tutor.fname || ""} ${tutor.lname || ""}`.trim() || tutor.email,
            email: tutor.email,
          };
        }
      }
    } else {
      // organization or organization_user
      // Try req.tutor first, otherwise fetch from database
      if (req?.tutor) {
        author = {
          id: req.tutor.organization_id || req.tutor.id,
          name:
            req.tutor.organization?.name || req.tutor.name || req.tutor.email,
          email: req.tutor.email,
        };
      } else {
        // Fetch from database
        const { Organization } = await import(
          "../../models/marketplace/organization.js"
        );
        const { OrganizationUser } = await import(
          "../../models/marketplace/organizationUser.js"
        );

        if (userType === "organization") {
          const org = await Organization.findByPk(userId, {
            attributes: ["id", "name", "email"],
          });
          if (org) {
            author = {
              id: org.id,
              name: org.name || org.email,
              email: org.email,
            };
          }
        } else {
          // organization_user
          const orgUser = await OrganizationUser.findByPk(userId, {
            attributes: ["id", "organization_id", "fname", "lname", "email"],
            include: [
              {
                model: Organization,
                as: "organization",
                attributes: ["id", "name"],
                required: false,
              },
            ],
          });
          if (orgUser) {
            author = {
              id: orgUser.organization_id || orgUser.id,
              name:
                orgUser.organization?.name ||
                `${orgUser.fname || ""} ${orgUser.lname || ""}`.trim() ||
                orgUser.email,
              email: orgUser.email,
            };
          }
        }
      }
    }
    authorName = author?.name || "Unknown";
  } else {
    // For students
    const student = await Students.findByPk(userId, {
      attributes: ["id", "fname", "lname", "mname", "email"],
    });
    if (student) {
      authorName =
        `${student.fname || ""} ${student.mname || ""} ${
          student.lname || ""
        }`.trim() || student.email;
      author = {
        id: student.id,
        name: authorName,
        email: student.email,
      };
    }
  }

  // Fallback if author not found
  if (!author) {
    author = {
      id: userId,
      name: "Unknown",
      email: "",
    };
    authorName = "Unknown";
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: "Comment created successfully",
    data: {
      ...comment.toJSON(),
      author: {
        id: author.id,
        name: authorName,
        email: author.email,
      },
    },
  });
});

/**
 * Get comments for post
 * GET /api/marketplace/communities/:id/posts/:postId/comments
 */
export const getComments = TryCatchFunction(async (req, res) => {
  const { id: communityId, postId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const userId = req.user?.id;
  const userType = req.user?.userType;

  // Check access (optional)
  if (userId) {
    try {
      await checkCommunityAccess(communityId, userId, userType, req);
    } catch (error) {
      // Allow viewing comments even without active subscription
    }
  }

  // Verify post exists
  const post = await CommunityPost.findByPk(postId);
  if (!post || post.community_id !== parseInt(communityId)) {
    throw new ErrorClass("Post not found", 404);
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows: comments } = await CommunityComment.findAndCountAll({
    where: {
      post_id: postId,
      status: "published",
    },
    limit: parseInt(limit),
    offset,
    order: [["created_at", "ASC"]],
    include: [
      {
        model: Students,
        as: "author",
        attributes: ["id", "fname", "lname", "mname", "email"],
      },
      {
        model: CommunityComment,
        as: "parentComment",
        include: [
          {
            model: Students,
            as: "author",
            attributes: ["id", "fname", "lname", "mname", "email"],
          },
        ],
      },
    ],
  });

  // Format comments
  const formattedComments = comments.map((comment) => {
    const author = comment.author;
    const authorName =
      `${author.fname || ""} ${author.mname || ""} ${
        author.lname || ""
      }`.trim() || author.email;

    const formatted = {
      ...comment.toJSON(),
      author: {
        id: author.id,
        name: authorName,
        email: author.email,
      },
    };

    if (comment.parentComment) {
      const parentAuthor = comment.parentComment.author;
      const parentAuthorName =
        `${parentAuthor.fname || ""} ${parentAuthor.mname || ""} ${
          parentAuthor.lname || ""
        }`.trim() || parentAuthor.email;

      formatted.parent_comment = {
        ...comment.parentComment.toJSON(),
        author: {
          id: parentAuthor.id,
          name: parentAuthorName,
          email: parentAuthor.email,
        },
      };
    }

    return formatted;
  });

  res.json({
    status: true,
    code: 200,
    message: "Comments retrieved successfully",
    data: {
      comments: formattedComments,
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
 * Upload file to community
 * POST /api/marketplace/communities/:id/files
 */
export const uploadFile = TryCatchFunction(async (req, res) => {
  const { id: communityId } = req.params;
  const userId = req.user?.id;
  const userType = req.user?.userType;

  // Check access (allows both students and tutors)
  await checkCommunityAccess(communityId, userId, userType, req);

  // Get community
  const community = await Community.findByPk(communityId);
  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  if (!community.file_sharing_enabled) {
    throw new ErrorClass("File sharing is disabled for this community", 403);
  }

  if (!req.file) {
    throw new ErrorClass("File is required", 400);
  }

  const { description, category } = req.body;

  // Upload to Supabase
  const fileExt = req.file.originalname.split(".").pop();
  const fileName = `communities/${communityId}/files/${userId}_${Date.now()}.${fileExt}`;
  const bucket = process.env.COMMUNITIES_BUCKET || "communities";

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new ErrorClass(`File upload failed: ${error.message}`, 500);
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);
  const fileUrl = urlData.publicUrl;

  // Create file record
  const file = await CommunityFile.create({
    community_id: communityId,
    uploaded_by: userId,
    file_name: req.file.originalname,
    file_url: fileUrl,
    file_type: req.file.mimetype,
    file_size: req.file.size,
    description: description || null,
    category: category || null,
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "File uploaded successfully",
    data: file,
  });
});

/**
 * Get files in community
 * GET /api/marketplace/communities/:id/files
 */
export const getFiles = TryCatchFunction(async (req, res) => {
  const { id: communityId } = req.params;
  const { page = 1, limit = 20, category, search } = req.query;
  const userId = req.user?.id;
  const userType = req.user?.userType;

  // Check access (allows both students and tutors)
  // If user is authenticated, verify access
  if (userId && userType) {
    try {
      await checkCommunityAccess(communityId, userId, userType, req);
    } catch (error) {
      // Re-throw the original error if it's already an ErrorClass
      if (error instanceof ErrorClass) {
        throw error;
      }
      // Otherwise throw generic access denied
      throw new ErrorClass(
        "You do not have access to view files in this community",
        403
      );
    }
  } else {
    // If not authenticated, deny access (files are private)
    throw new ErrorClass("Authentication required to view files", 401);
  }

  const where = {
    community_id: communityId,
  };

  if (category) {
    where.category = category;
  }

  if (search) {
    where[Op.or] = [
      { file_name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows: files } = await CommunityFile.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["created_at", "DESC"]],
    include: [
      {
        model: Students,
        as: "uploader",
        attributes: ["id", "fname", "lname", "mname", "email"],
      },
    ],
  });

  // Format files
  const formattedFiles = files.map((file) => {
    const uploader = file.uploader;
    const uploaderName =
      `${uploader.fname || ""} ${uploader.mname || ""} ${
        uploader.lname || ""
      }`.trim() || uploader.email;

    return {
      ...file.toJSON(),
      uploader: {
        id: uploader.id,
        name: uploaderName,
        email: uploader.email,
      },
    };
  });

  res.json({
    status: true,
    code: 200,
    message: "Files retrieved successfully",
    data: {
      files: formattedFiles,
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
 * Delete file
 * DELETE /api/marketplace/communities/:id/files/:fileId
 */
export const deleteFile = TryCatchFunction(async (req, res) => {
  const { id: communityId, fileId } = req.params;
  const userId = req.user?.id;
  const userType = req.user?.userType;

  // Check access (allows both students and tutors)
  const access = await checkCommunityAccess(communityId, userId, userType, req);

  // Build where clause - allow tutors to delete any file in their community, students only their own
  const where = {
    id: fileId,
    community_id: communityId,
  };

  if (!access.isOwner) {
    // Students can only delete their own files
    where.uploaded_by = userId;
  }

  const file = await CommunityFile.findOne({ where });

  if (!file) {
    throw new ErrorClass(
      "File not found or you don't have permission to delete it",
      404
    );
  }

  // Delete from Supabase
  try {
    const urlParts = file.file_url.split("/");
    const fileName = urlParts.slice(urlParts.indexOf("communities")).join("/");
    const bucket = process.env.COMMUNITIES_BUCKET || "communities";
    await supabase.storage.from(bucket).remove([fileName]);
  } catch (error) {
    console.error("Error deleting file from storage:", error);
  }

  await file.destroy();

  res.json({
    status: true,
    code: 200,
    message: "File deleted successfully",
  });
});
