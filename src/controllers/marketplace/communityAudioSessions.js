/**
 * Community Audio Sessions Controller
 * Handles audio-only calls for communities (subscription-gated)
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Community } from "../../models/marketplace/community.js";
import { CommunityMember } from "../../models/marketplace/communityMember.js";
import { CommunityAudioSession } from "../../models/marketplace/communityAudioSession.js";
import { TutorSubscription } from "../../models/marketplace/tutorSubscription.js";
import { streamVideoService } from "../../service/streamVideoService.js";
import { Config } from "../../config/config.js";
import { Op } from "sequelize";

/**
 * Helper to check if tutor has active subscription (required for audio sessions)
 */
async function checkTutorSubscription(tutorId, tutorType) {
  const subscription = await TutorSubscription.findOne({
    where: {
      tutor_id: tutorId,
      tutor_type: tutorType,
      status: "active",
    },
  });

  if (!subscription) {
    throw new ErrorClass("You need an active subscription to create audio sessions", 403);
  }

  // Check if subscription is expired
  if (subscription.end_date && new Date() > new Date(subscription.end_date)) {
    throw new ErrorClass("Your subscription has expired. Please renew to create audio sessions", 403);
  }

  return subscription;
}

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
 * Create audio session
 * POST /api/marketplace/tutor/communities/:id/audio-sessions
 */
export const createAudioSession = TryCatchFunction(async (req, res) => {
  const { id: communityId } = req.params;
  const { tutorId, tutorType } = getTutorInfo(req);

  // Check tutor subscription
  await checkTutorSubscription(tutorId, tutorType);

  // Get community
  const community = await Community.findByPk(communityId);
  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  // Verify tutor owns community
  if (community.tutor_id !== tutorId || community.tutor_type !== tutorType) {
    throw new ErrorClass("You don't have permission to create sessions for this community", 403);
  }

  if (!community.live_sessions_enabled) {
    throw new ErrorClass("Live sessions are disabled for this community", 403);
  }

  const { title, description, scheduled_start_time, scheduled_end_time } = req.body;

  if (!title) {
    throw new ErrorClass("Session title is required", 400);
  }

  // Create Stream.io audio call (audio-only)
  const callId = `community-audio-${communityId}-${Date.now()}`;
  const streamCall = await streamVideoService.getOrCreateCall("default", callId, {
    createdBy: String(tutorId),
    record: false,
    startsAt: scheduled_start_time || new Date().toISOString(),
    audioOnly: true, // Audio-only call
  });

  const viewLink = `${Config.frontendUrl}/communities/${communityId}/audio/${callId}`;

  // Create session record
  const session = await CommunityAudioSession.create({
    community_id: communityId,
    created_by: tutorId,
    title,
    description: description || null,
    stream_call_id: callId,
    view_link: viewLink,
    scheduled_start_time: scheduled_start_time ? new Date(scheduled_start_time) : null,
    scheduled_end_time: scheduled_end_time ? new Date(scheduled_end_time) : null,
    status: "scheduled",
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "Audio session created successfully",
    data: session,
  });
});

/**
 * Get audio sessions for community (Tutor endpoint)
 * GET /api/marketplace/tutor/communities/:id/audio-sessions
 */
export const getTutorAudioSessions = TryCatchFunction(async (req, res) => {
  const { id: communityId } = req.params;
  const { tutorId, tutorType } = getTutorInfo(req);
  const { page = 1, limit = 20, status } = req.query;

  // Verify tutor owns community
  const community = await Community.findByPk(communityId);
  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  if (community.tutor_id !== tutorId || community.tutor_type !== tutorType) {
    throw new ErrorClass("You don't have permission to view sessions for this community", 403);
  }

  const where = {
    community_id: communityId,
  };

  if (status) {
    where.status = status;
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows: sessions } = await CommunityAudioSession.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["created_at", "DESC"]],
  });

  res.json({
    status: true,
    code: 200,
    message: "Audio sessions retrieved successfully",
    data: {
      sessions,
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
 * Get audio sessions for community (Student endpoint)
 * GET /api/marketplace/communities/:id/audio-sessions
 */
export const getAudioSessions = TryCatchFunction(async (req, res) => {
  const { id: communityId } = req.params;
  const { page = 1, limit = 20, status } = req.query;
  const studentId = req.user?.id;

  // Check access (optional for public browsing)
  if (studentId) {
    try {
      await checkCommunityAccess(communityId, studentId);
    } catch (error) {
      // Allow viewing scheduled sessions even without active subscription
    }
  }

  const where = {
    community_id: communityId,
  };

  if (status) {
    where.status = status;
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows: sessions } = await CommunityAudioSession.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["created_at", "DESC"]],
  });

  res.json({
    status: true,
    code: 200,
    message: "Audio sessions retrieved successfully",
    data: {
      sessions,
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
 * Get single audio session
 * GET /api/marketplace/communities/:id/audio-sessions/:sessionId
 */
export const getAudioSession = TryCatchFunction(async (req, res) => {
  const { id: communityId, sessionId } = req.params;
  const studentId = req.user?.id;

  // Check access
  if (studentId) {
    await checkCommunityAccess(communityId, studentId);
  }

  const session = await CommunityAudioSession.findOne({
    where: {
      id: sessionId,
      community_id: communityId,
    },
  });

  if (!session) {
    throw new ErrorClass("Audio session not found", 404);
  }

  res.json({
    status: true,
    code: 200,
    message: "Audio session retrieved successfully",
    data: session,
  });
});

/**
 * Start audio session
 * POST /api/marketplace/tutor/communities/:id/audio-sessions/:sessionId/start
 */
export const startAudioSession = TryCatchFunction(async (req, res) => {
  const { id: communityId, sessionId } = req.params;
  const { tutorId, tutorType } = getTutorInfo(req);

  // Check tutor subscription
  await checkTutorSubscription(tutorId, tutorType);

  const session = await CommunityAudioSession.findOne({
    where: {
      id: sessionId,
      community_id: communityId,
      created_by: tutorId,
    },
  });

  if (!session) {
    throw new ErrorClass("Audio session not found", 404);
  }

  if (session.status !== "scheduled") {
    throw new ErrorClass("Session cannot be started. Current status: " + session.status, 400);
  }

  await session.update({
    status: "active",
    actual_start_time: new Date(),
  });

  res.json({
    status: true,
    code: 200,
    message: "Audio session started successfully",
    data: session,
  });
});

/**
 * End audio session
 * POST /api/marketplace/tutor/communities/:id/audio-sessions/:sessionId/end
 */
export const endAudioSession = TryCatchFunction(async (req, res) => {
  const { id: communityId, sessionId } = req.params;
  const { tutorId, tutorType } = getTutorInfo(req);

  const session = await CommunityAudioSession.findOne({
    where: {
      id: sessionId,
      community_id: communityId,
      created_by: tutorId,
    },
  });

  if (!session) {
    throw new ErrorClass("Audio session not found", 404);
  }

  if (session.status !== "active") {
    throw new ErrorClass("Session is not active", 400);
  }

  await session.update({
    status: "ended",
    actual_end_time: new Date(),
  });

  res.json({
    status: true,
    code: 200,
    message: "Audio session ended successfully",
    data: session,
  });
});

/**
 * Get join token for audio session (student)
 * POST /api/marketplace/communities/:id/audio-sessions/:sessionId/join-token
 */
export const getJoinToken = TryCatchFunction(async (req, res) => {
  const { id: communityId, sessionId } = req.params;
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can join audio sessions", 403);
  }

  // Check access
  await checkCommunityAccess(communityId, studentId);

  const session = await CommunityAudioSession.findOne({
    where: {
      id: sessionId,
      community_id: communityId,
    },
  });

  if (!session) {
    throw new ErrorClass("Audio session not found", 404);
  }

  if (session.status !== "active" && session.status !== "scheduled") {
    throw new ErrorClass("Session is not available", 400);
  }

  // Get Stream.io token
  const token = streamVideoService.generateUserToken(String(studentId));

  res.json({
    status: true,
    code: 200,
    message: "Join token generated successfully",
    data: {
      token,
      call_id: session.stream_call_id,
      view_link: session.view_link,
    },
  });
});

/**
 * Cancel audio session
 * DELETE /api/marketplace/tutor/communities/:id/audio-sessions/:sessionId
 */
export const cancelAudioSession = TryCatchFunction(async (req, res) => {
  const { id: communityId, sessionId } = req.params;
  const { tutorId, tutorType } = getTutorInfo(req);

  const session = await CommunityAudioSession.findOne({
    where: {
      id: sessionId,
      community_id: communityId,
      created_by: tutorId,
    },
  });

  if (!session) {
    throw new ErrorClass("Audio session not found", 404);
  }

  if (session.status === "ended") {
    throw new ErrorClass("Cannot cancel an ended session", 400);
  }

  await session.update({
    status: "cancelled",
  });

  res.json({
    status: true,
    code: 200,
    message: "Audio session cancelled successfully",
  });
});

