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

/**
 * Helper to check if student has active access to community
 */
async function checkCommunityAccess(communityId, studentId) {
  const member = await CommunityMember.findOne({
    where: {
      community_id: communityId,
      student_id: studentId,
      status: "active",
      subscription_status: "active",
    },
  });

  if (!member) {
    throw new ErrorClass("You do not have active access to this community", 403);
  }

  return member;
}

/**
 * Create a post in community
 * POST /api/marketplace/communities/:id/posts
 */
export const createPost = TryCatchFunction(async (req, res) => {
  const { id: communityId } = req.params;
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can create posts", 403);
  }

  // Check access
  await checkCommunityAccess(communityId, studentId);

  // Get community
  const community = await Community.findByPk(communityId);
  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  // Check who can post
  if (community.who_can_post === "tutor_only") {
    throw new ErrorClass("Only the tutor can create posts in this community", 403);
  }

  const { title, content, content_type = "text", category, tags } = req.body;

  if (!content) {
    throw new ErrorClass("Post content is required", 400);
  }

  const post = await CommunityPost.create({
    community_id: communityId,
    author_id: studentId,
    title: title || null,
    content,
    content_type,
    category: category || null,
    tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : null,
    status: "published",
  });

  // Increment post count
  await community.increment("post_count");

  // Get author info
  const author = await Students.findByPk(studentId, {
    attributes: ["id", "fname", "lname", "mname", "email"],
  });

  const authorName = `${author.fname || ""} ${author.mname || ""} ${author.lname || ""}`.trim() || author.email;

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
  const { page = 1, limit = 20, category, search, status = "published" } = req.query;
  const studentId = req.user?.id;

  // Check if user has access (optional auth for public browsing)
  if (studentId) {
    try {
      await checkCommunityAccess(communityId, studentId);
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
    const authorName = `${author.fname || ""} ${author.mname || ""} ${author.lname || ""}`.trim() || author.email;

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
  const studentId = req.user?.id;

  // Check access
  if (studentId) {
    try {
      await checkCommunityAccess(communityId, studentId);
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
  const authorName = `${author.fname || ""} ${author.mname || ""} ${author.lname || ""}`.trim() || author.email;

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
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can update posts", 403);
  }

  // Check access
  await checkCommunityAccess(communityId, studentId);

  const post = await CommunityPost.findOne({
    where: {
      id: postId,
      community_id: communityId,
      author_id: studentId,
    },
  });

  if (!post) {
    throw new ErrorClass("Post not found or you don't have permission to update it", 404);
  }

  const { title, content, content_type, category, tags } = req.body;

  if (title !== undefined) post.title = title;
  if (content !== undefined) post.content = content;
  if (content_type !== undefined) post.content_type = content_type;
  if (category !== undefined) post.category = category;
  if (tags !== undefined) post.tags = tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : null;

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
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can delete posts", 403);
  }

  // Check access
  await checkCommunityAccess(communityId, studentId);

  const post = await CommunityPost.findOne({
    where: {
      id: postId,
      community_id: communityId,
      author_id: studentId,
    },
  });

  if (!post) {
    throw new ErrorClass("Post not found or you don't have permission to delete it", 404);
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
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can create comments", 403);
  }

  // Check access
  await checkCommunityAccess(communityId, studentId);

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
    author_id: studentId,
    parent_comment_id: parent_comment_id || null,
    content,
    status: "published",
  });

  // Increment comment count
  await post.increment("comments_count");

  // Get author info
  const author = await Students.findByPk(studentId, {
    attributes: ["id", "fname", "lname", "mname", "email"],
  });

  const authorName = `${author.fname || ""} ${author.mname || ""} ${author.lname || ""}`.trim() || author.email;

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
  const studentId = req.user?.id;

  // Check access (optional)
  if (studentId) {
    try {
      await checkCommunityAccess(communityId, studentId);
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
    const authorName = `${author.fname || ""} ${author.mname || ""} ${author.lname || ""}`.trim() || author.email;

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
      const parentAuthorName = `${parentAuthor.fname || ""} ${parentAuthor.mname || ""} ${parentAuthor.lname || ""}`.trim() || parentAuthor.email;

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
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can upload files", 403);
  }

  // Check access
  await checkCommunityAccess(communityId, studentId);

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
  const fileName = `communities/${communityId}/files/${studentId}_${Date.now()}.${fileExt}`;
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

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
  const fileUrl = urlData.publicUrl;

  // Create file record
  const file = await CommunityFile.create({
    community_id: communityId,
    uploaded_by: studentId,
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
  const studentId = req.user?.id;

  // Check access
  if (studentId) {
    try {
      await checkCommunityAccess(communityId, studentId);
    } catch (error) {
      throw new ErrorClass("You do not have access to view files in this community", 403);
    }
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
    const uploaderName = `${uploader.fname || ""} ${uploader.mname || ""} ${uploader.lname || ""}`.trim() || uploader.email;

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
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can delete files", 403);
  }

  // Check access
  await checkCommunityAccess(communityId, studentId);

  const file = await CommunityFile.findOne({
    where: {
      id: fileId,
      community_id: communityId,
      uploaded_by: studentId,
    },
  });

  if (!file) {
    throw new ErrorClass("File not found or you don't have permission to delete it", 404);
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

