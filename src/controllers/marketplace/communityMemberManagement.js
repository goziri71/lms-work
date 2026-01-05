/**
 * Community Member Management Controller
 * Handles member management for communities
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Community } from "../../models/marketplace/community.js";
import { CommunityMember } from "../../models/marketplace/communityMember.js";
import { Students } from "../../models/auth/student.js";
import { Op } from "sequelize";

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
 * Get all members of a community
 * GET /api/marketplace/tutor/communities/:id/members
 */
export const getMembers = TryCatchFunction(async (req, res) => {
  const { id: communityId } = req.params;
  const { tutorId, tutorType } = getTutorInfo(req);
  const { page = 1, limit = 20, status, role, search } = req.query;

  // Verify tutor owns community
  const community = await Community.findByPk(communityId);
  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  if (community.tutor_id !== tutorId || community.tutor_type !== tutorType) {
    throw new ErrorClass("You don't have permission to view members of this community", 403);
  }

  const where = {
    community_id: communityId,
  };

  if (status) {
    where.status = status;
  }

  if (role) {
    where.role = role;
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows: members } = await CommunityMember.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["joined_at", "DESC"]],
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "mname", "email", "matric_number"],
        where: search
          ? {
              [Op.or]: [
                { fname: { [Op.iLike]: `%${search}%` } },
                { lname: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { matric_number: { [Op.iLike]: `%${search}%` } },
              ],
            }
          : undefined,
        required: true,
      },
    ],
  });

  // Format members
  const formattedMembers = members.map((member) => {
    const student = member.student;
    const studentName = `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim() || student.email;

    return {
      ...member.toJSON(),
      student: {
        id: student.id,
        name: studentName,
        email: student.email,
        matric_number: student.matric_number,
      },
    };
  });

  res.json({
    status: true,
    code: 200,
    message: "Members retrieved successfully",
    data: {
      members: formattedMembers,
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
 * Get single member
 * GET /api/marketplace/tutor/communities/:id/members/:memberId
 */
export const getMember = TryCatchFunction(async (req, res) => {
  const { id: communityId, memberId } = req.params;
  const { tutorId, tutorType } = getTutorInfo(req);

  // Verify tutor owns community
  const community = await Community.findByPk(communityId);
  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  if (community.tutor_id !== tutorId || community.tutor_type !== tutorType) {
    throw new ErrorClass("You don't have permission to view members of this community", 403);
  }

  const member = await CommunityMember.findOne({
    where: {
      id: memberId,
      community_id: communityId,
    },
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "mname", "email", "matric_number"],
      },
    ],
  });

  if (!member) {
    throw new ErrorClass("Member not found", 404);
  }

  const student = member.student;
  const studentName = `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim() || student.email;

  res.json({
    status: true,
    code: 200,
    message: "Member retrieved successfully",
    data: {
      ...member.toJSON(),
      student: {
        id: student.id,
        name: studentName,
        email: student.email,
        matric_number: student.matric_number,
      },
    },
  });
});

/**
 * Update member role
 * PUT /api/marketplace/tutor/communities/:id/members/:memberId/role
 */
export const updateMemberRole = TryCatchFunction(async (req, res) => {
  const { id: communityId, memberId } = req.params;
  const { tutorId, tutorType } = getTutorInfo(req);
  const { role } = req.body;

  if (!role || !["member", "moderator", "admin"].includes(role)) {
    throw new ErrorClass("Invalid role. Must be: member, moderator, or admin", 400);
  }

  // Verify tutor owns community
  const community = await Community.findByPk(communityId);
  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  if (community.tutor_id !== tutorId || community.tutor_type !== tutorType) {
    throw new ErrorClass("You don't have permission to manage members of this community", 403);
  }

  const member = await CommunityMember.findOne({
    where: {
      id: memberId,
      community_id: communityId,
    },
  });

  if (!member) {
    throw new ErrorClass("Member not found", 404);
  }

  await member.update({ role });

  res.json({
    status: true,
    code: 200,
    message: "Member role updated successfully",
    data: member,
  });
});

/**
 * Block member
 * PUT /api/marketplace/tutor/communities/:id/members/:memberId/block
 */
export const blockMember = TryCatchFunction(async (req, res) => {
  const { id: communityId, memberId } = req.params;
  const { tutorId, tutorType } = getTutorInfo(req);

  // Verify tutor owns community
  const community = await Community.findByPk(communityId);
  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  if (community.tutor_id !== tutorId || community.tutor_type !== tutorType) {
    throw new ErrorClass("You don't have permission to manage members of this community", 403);
  }

  const member = await CommunityMember.findOne({
    where: {
      id: memberId,
      community_id: communityId,
    },
  });

  if (!member) {
    throw new ErrorClass("Member not found", 404);
  }

  if (member.status === "blocked") {
    throw new ErrorClass("Member is already blocked", 400);
  }

  await member.update({ status: "blocked" });

  res.json({
    status: true,
    code: 200,
    message: "Member blocked successfully",
    data: member,
  });
});

/**
 * Unblock member
 * PUT /api/marketplace/tutor/communities/:id/members/:memberId/unblock
 */
export const unblockMember = TryCatchFunction(async (req, res) => {
  const { id: communityId, memberId } = req.params;
  const { tutorId, tutorType } = getTutorInfo(req);

  // Verify tutor owns community
  const community = await Community.findByPk(communityId);
  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  if (community.tutor_id !== tutorId || community.tutor_type !== tutorType) {
    throw new ErrorClass("You don't have permission to manage members of this community", 403);
  }

  const member = await CommunityMember.findOne({
    where: {
      id: memberId,
      community_id: communityId,
    },
  });

  if (!member) {
    throw new ErrorClass("Member not found", 404);
  }

  if (member.status !== "blocked") {
    throw new ErrorClass("Member is not blocked", 400);
  }

  await member.update({ status: "active" });

  res.json({
    status: true,
    code: 200,
    message: "Member unblocked successfully",
    data: member,
  });
});

/**
 * Remove member from community
 * DELETE /api/marketplace/tutor/communities/:id/members/:memberId
 */
export const removeMember = TryCatchFunction(async (req, res) => {
  const { id: communityId, memberId } = req.params;
  const { tutorId, tutorType } = getTutorInfo(req);

  // Verify tutor owns community
  const community = await Community.findByPk(communityId);
  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  if (community.tutor_id !== tutorId || community.tutor_type !== tutorType) {
    throw new ErrorClass("You don't have permission to manage members of this community", 403);
  }

  const member = await CommunityMember.findOne({
    where: {
      id: memberId,
      community_id: communityId,
    },
  });

  if (!member) {
    throw new ErrorClass("Member not found", 404);
  }

  // Mark as left instead of deleting
  await member.update({ status: "left" });

  // Decrement member count
  await community.decrement("member_count");

  res.json({
    status: true,
    code: 200,
    message: "Member removed successfully",
  });
});

