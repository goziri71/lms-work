/**
 * Student Community Controller
 * Endpoints for students to check subscription status and list their communities
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Community } from "../../models/marketplace/community.js";
import { CommunitySubscription } from "../../models/marketplace/communitySubscription.js";
import { CommunityMember } from "../../models/marketplace/communityMember.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";

/**
 * Get current student's subscription/membership status for a community
 * GET /api/marketplace/communities/:id/subscription
 * Returns 404 if not subscribed; returns subscription + member info if subscribed
 */
export const getMySubscriptionForCommunity = TryCatchFunction(
  async (req, res) => {
    const { id: communityId } = req.params;
    const studentId = req.user?.id;

    if (req.user?.userType !== "student") {
      throw new ErrorClass("Only students can access this endpoint", 403);
    }

    const community = await Community.findByPk(communityId, {
      attributes: ["id", "name", "slug", "image_url", "status", "visibility"],
    });

    if (!community) {
      throw new ErrorClass("Community not found", 404);
    }

    const member = await CommunityMember.findOne({
      where: {
        community_id: communityId,
        student_id: studentId,
      },
    });

    const subscription = await CommunitySubscription.findOne({
      where: {
        community_id: communityId,
        student_id: studentId,
      },
    });

    const isSubscribed =
      member?.status === "active" && member?.subscription_status === "active";

    if (!isSubscribed) {
      return res.status(200).json({
        success: true,
        data: {
          subscribed: false,
          community: {
            id: community.id,
            name: community.name,
            slug: community.slug,
            image_url: community.image_url,
          },
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        subscribed: true,
        community: {
          id: community.id,
          name: community.name,
          slug: community.slug,
          image_url: community.image_url,
        },
        member: {
          id: member.id,
          role: member.role,
          status: member.status,
          subscription_status: member.subscription_status,
          joined_at: member.joined_at,
          subscription_end_date: member.subscription_end_date,
          next_billing_date: member.next_billing_date,
        },
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              start_date: subscription.start_date,
              end_date: subscription.end_date,
              next_billing_date: subscription.next_billing_date,
              auto_renew: subscription.auto_renew,
            }
          : null,
      },
    });
  }
);

/**
 * Get list of communities the current student has joined
 * GET /api/marketplace/my-communities
 */
export const getMyCommunities = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  const members = await CommunityMember.findAll({
    where: {
      student_id: studentId,
      status: "active",
      subscription_status: "active",
    },
    order: [["joined_at", "DESC"]],
  });

  if (members.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        communities: [],
        total: 0,
      },
    });
  }

  const communityIds = [...new Set(members.map((m) => m.community_id))];
  const communities = await Community.findAll({
    where: {
      id: communityIds,
      status: "published",
    },
    attributes: [
      "id",
      "name",
      "slug",
      "description",
      "image_url",
      "category",
      "price",
      "currency",
      "member_count",
      "tutor_id",
      "tutor_type",
    ],
  });

  const tutorIds = [...new Set(communities.map((c) => c.tutor_id))];
  const soleTutorIds = communities
    .filter((c) => c.tutor_type === "sole_tutor")
    .map((c) => c.tutor_id);
  const orgIds = communities
    .filter((c) => c.tutor_type === "organization")
    .map((c) => c.tutor_id);

  const [soleTutors, organizations] = await Promise.all([
    soleTutorIds.length > 0
      ? SoleTutor.findAll({
          where: { id: soleTutorIds },
          attributes: ["id", "fname", "lname", "profile_image"],
        })
      : [],
    orgIds.length > 0
      ? Organization.findAll({
          where: { id: orgIds },
          attributes: ["id", "name", "logo"],
        })
      : [],
  ]);

  const tutorMap = new Map();
  soleTutors.forEach((t) =>
    tutorMap.set(t.id, {
      name: `${t.fname} ${t.lname}`.trim(),
      image: t.profile_image,
    })
  );
  organizations.forEach((o) =>
    tutorMap.set(o.id, { name: o.name, image: o.logo })
  );

  const memberByCommunity = new Map(members.map((m) => [m.community_id, m]));
  const communityList = communities.map((c) => {
    const member = memberByCommunity.get(c.id);
    const tutor = tutorMap.get(c.tutor_id);
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image_url: c.image_url,
      category: c.category,
      price: parseFloat(c.price || 0),
      currency: c.currency || "NGN",
      member_count: c.member_count,
      tutor: tutor || null,
      my_membership: member
        ? {
            role: member.role,
            joined_at: member.joined_at,
            subscription_end_date: member.subscription_end_date,
          }
        : null,
    };
  });

  res.status(200).json({
    success: true,
    data: {
      communities: communityList,
      total: communityList.length,
    },
  });
});
