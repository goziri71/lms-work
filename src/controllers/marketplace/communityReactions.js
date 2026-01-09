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

// Helper function to get user info for reactions (handles both tutors and students)
async function getUserInfoForReaction(userId, userType, community) {
  if (userType === "student") {
    const student = await Students.findByPk(userId, {
      attributes: ["id", "fname", "lname", "mname", "email"],
    });
    if (student) {
      return {
        id: student.id,
        name: `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim() || student.email,
        email: student.email,
      };
    }
  } else if (userType === "tutor") {
    // Check if user is the community tutor
    if (community && Number(community.tutor_id) === Number(userId)) {
      if (community.tutor_type === "sole_tutor") {
        const { SoleTutor } = await import("../../models/marketplace/soleTutor.js");
        const tutor = await SoleTutor.findByPk(userId, {
          attributes: ["id", "fname", "lname", "email"],
        });
        if (tutor) {
          return {
            id: tutor.id,
            name: `${tutor.fname || ""} ${tutor.lname || ""}`.trim() || tutor.email,
            email: tutor.email,
          };
        }
      } else if (community.tutor_type === "organization") {
        const { Organization } = await import("../../models/marketplace/organization.js");
        const org = await Organization.findByPk(userId, {
          attributes: ["id", "name", "email"],
        });
        if (org) {
          return {
            id: org.id,
            name: org.name || org.email,
            email: org.email,
          };
        }
      }
    }

    // Check if user is an organization_user whose organization_id matches community tutor_id
    if (community && community.tutor_type === "organization") {
      const { OrganizationUser } = await import("../../models/marketplace/organizationUser.js");
      const { Organization } = await import("../../models/marketplace/organization.js");
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
      if (orgUser && Number(orgUser.organization_id) === Number(community.tutor_id)) {
        return {
          id: orgUser.organization_id || orgUser.id,
          name: orgUser.organization?.name || `${orgUser.fname || ""} ${orgUser.lname || ""}`.trim() || orgUser.email,
          email: orgUser.email,
        };
      }
    }
  }

  // Fallback
  return {
    id: userId,
    name: "Unknown",
    email: "",
  };
}

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

  // Get community info to check tutor
  const community = await Community.findByPk(communityId, {
    attributes: ["id", "tutor_id", "tutor_type"],
  });

  // Get reactions
  const reactions = await CommunityReaction.findAll({
    where: {
      post_id: post_id || null,
      comment_id: comment_id || null,
    },
    order: [["created_at", "DESC"]],
  });

  // Group by emoji and get user info for each reaction
  const groupedReactions = {};
  await Promise.all(
    reactions.map(async (reaction) => {
      if (!groupedReactions[reaction.emoji]) {
        groupedReactions[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [],
          user_reacted: false,
        };
      }
      groupedReactions[reaction.emoji].count++;

      // Get user info (handles both tutors and students)
      const userInfo = await getUserInfoForReaction(
        reaction.user_id,
        reaction.user_type,
        community
      );
      groupedReactions[reaction.emoji].users.push(userInfo);

      // Check if current user reacted with this emoji
      if (userId && reaction.user_id === userId) {
        groupedReactions[reaction.emoji].user_reacted = true;
      }
    })
  );

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

