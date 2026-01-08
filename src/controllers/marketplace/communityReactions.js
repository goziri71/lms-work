/**
 * Community Reactions Controller
 * Handles emoji reactions on posts and comments
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CommunityReaction } from "../../models/marketplace/communityReaction.js";
import { CommunityPost } from "../../models/marketplace/communityPost.js";
import { CommunityComment } from "../../models/marketplace/communityComment.js";
import { Community } from "../../models/marketplace/community.js";
import { CommunityMember } from "../../models/marketplace/communityMember.js";
import { Students } from "../../models/auth/student.js";
import { Op } from "sequelize";

/**
 * Helper to check if user has access to community
 */
async function checkCommunityAccess(communityId, userId, userType, req = null) {
  // Check if user is the community owner (tutor)
  if (
    userType === "sole_tutor" ||
    userType === "organization" ||
    userType === "organization_user"
  ) {
    const community = await Community.findByPk(communityId);
    if (!community) {
      throw new ErrorClass("Community not found", 404);
    }

    let tutorId, tutorType;
    if (userType === "sole_tutor") {
      tutorId = req?.tutor?.id || userId;
      tutorType = "sole_tutor";
    } else if (userType === "organization") {
      tutorId = req?.tutor?.id || userId;
      tutorType = "organization";
    } else if (userType === "organization_user") {
      if (req?.tutor?.organization_id) {
        tutorId = req.tutor.organization_id;
      } else if (req?.user?.organizationId) {
        tutorId = req.user.organizationId;
      } else {
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

    if (
      community.tutor_id === parseInt(tutorId) &&
      community.tutor_type === tutorType
    ) {
      return true; // Tutor owns community
    }
  }

  // Check if student has active membership
  const member = await CommunityMember.findOne({
    where: {
      community_id: communityId,
      student_id: userId,
      status: "active",
      subscription_status: "active",
    },
  });

  if (!member) {
    throw new ErrorClass("You do not have active access to this community", 403);
  }

  return true;
}

/**
 * Add reaction to post or comment
 * POST /api/marketplace/communities/:id/reactions
 */
export const addReaction = TryCatchFunction(async (req, res) => {
  const { id: communityId } = req.params;
  const userId = req.user?.id;
  const userType = req.user?.userType;

  // Check access
  await checkCommunityAccess(communityId, userId, userType, req);

  const { post_id, comment_id, emoji } = req.body;

  if (!emoji) {
    throw new ErrorClass("Emoji is required", 400);
  }

  if (!post_id && !comment_id) {
    throw new ErrorClass("Either post_id or comment_id is required", 400);
  }

  if (post_id && comment_id) {
    throw new ErrorClass("Cannot react to both post and comment at the same time", 400);
  }

  // Verify post or comment exists and belongs to community
  if (post_id) {
    const post = await CommunityPost.findByPk(post_id);
    if (!post || post.community_id !== parseInt(communityId)) {
      throw new ErrorClass("Post not found", 404);
    }
  }

  if (comment_id) {
    const comment = await CommunityComment.findByPk(comment_id);
    if (!comment) {
      throw new ErrorClass("Comment not found", 404);
    }
    // Verify comment's post belongs to community
    const post = await CommunityPost.findByPk(comment.post_id);
    if (!post || post.community_id !== parseInt(communityId)) {
      throw new ErrorClass("Comment not found in this community", 404);
    }
  }

  // Determine user type
  const reactionUserType = userType === "student" ? "student" : "tutor";

  // Check if reaction already exists
  const existingReaction = await CommunityReaction.findOne({
    where: {
      post_id: post_id || null,
      comment_id: comment_id || null,
      user_id: userId,
      user_type: reactionUserType,
      emoji,
    },
  });

  if (existingReaction) {
    // Remove reaction (toggle off)
    await existingReaction.destroy();

    // Update counts
    if (post_id) {
      await CommunityPost.decrement("likes_count", {
        where: { id: post_id },
      });
    }

    res.json({
      status: true,
      code: 200,
      message: "Reaction removed",
      data: {
        reacted: false,
        emoji,
      },
    });
    return;
  }

  // Create reaction
  const reaction = await CommunityReaction.create({
    post_id: post_id || null,
    comment_id: comment_id || null,
    user_id: userId,
    user_type: reactionUserType,
    emoji,
  });

  // Update counts
  if (post_id) {
    await CommunityPost.increment("likes_count", {
      where: { id: post_id },
    });
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: "Reaction added",
    data: {
      id: reaction.id,
      emoji: reaction.emoji,
      reacted: true,
    },
  });
});

/**
 * Get reactions for post or comment
 * GET /api/marketplace/communities/:id/reactions?post_id=X or ?comment_id=X
 */
export const getReactions = TryCatchFunction(async (req, res) => {
  const { id: communityId } = req.params;
  const { post_id, comment_id } = req.query;
  const userId = req.user?.id;
  const userType = req.user?.userType;

  // Check access (optional for viewing)
  if (userId) {
    try {
      await checkCommunityAccess(communityId, userId, userType, req);
    } catch (error) {
      // Allow viewing reactions even without active subscription
    }
  }

  if (!post_id && !comment_id) {
    throw new ErrorClass("Either post_id or comment_id is required", 400);
  }

  // Get reactions
  const reactions = await CommunityReaction.findAll({
    where: {
      post_id: post_id || null,
      comment_id: comment_id || null,
    },
    include: [
      {
        model: Students,
        as: "user",
        attributes: ["id", "fname", "lname", "mname", "email"],
        required: false,
      },
    ],
    order: [["created_at", "DESC"]],
  });

  // Group by emoji
  const groupedReactions = {};
  reactions.forEach((reaction) => {
    if (!groupedReactions[reaction.emoji]) {
      groupedReactions[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        users: [],
        user_reacted: false,
      };
    }
    groupedReactions[reaction.emoji].count++;
    
    if (reaction.user) {
      const userName = `${reaction.user.fname || ""} ${reaction.user.mname || ""} ${reaction.user.lname || ""}`.trim() || reaction.user.email;
      groupedReactions[reaction.emoji].users.push({
        id: reaction.user.id,
        name: userName,
        email: reaction.user.email,
      });
    }

    // Check if current user reacted with this emoji
    if (userId && reaction.user_id === userId) {
      groupedReactions[reaction.emoji].user_reacted = true;
    }
  });

  res.json({
    status: true,
    code: 200,
    message: "Reactions retrieved successfully",
    data: {
      reactions: Object.values(groupedReactions),
      total: reactions.length,
    },
  });
});

