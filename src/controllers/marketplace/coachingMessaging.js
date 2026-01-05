/**
 * REST API endpoints for One-on-One Coaching Messaging
 * Handles message history, pagination, and time proposals
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CoachingSchedulingMessage } from "../../models/marketplace/coachingSchedulingMessage.js";
import { CoachingSession } from "../../models/marketplace/coachingSession.js";
import { CoachingSessionPurchase } from "../../models/marketplace/coachingSessionPurchase.js";
import { Students } from "../../models/auth/student.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { Op } from "sequelize";

/**
 * Get messages for a coaching session (with pagination)
 * GET /api/marketplace/coaching/sessions/:sessionId/messages
 */
export const getSessionMessages = TryCatchFunction(async (req, res) => {
  const { sessionId } = req.params;
  const { page = 1, limit = 50, before } = req.query;
  const userId = req.user.id;
  const userType = req.user.userType;

  // Get session
  const session = await CoachingSession.findByPk(sessionId);
  if (!session) {
    throw new ErrorClass("Session not found", 404);
  }

  if (session.session_type !== "one_on_one") {
    throw new ErrorClass("This endpoint is only for one-on-one sessions", 400);
  }

  // Verify access
  let hasAccess = false;
  if (userType === "sole_tutor" || userType === "organization") {
    hasAccess =
      session.tutor_id === userId &&
      session.tutor_type ===
        (userType === "sole_tutor" ? "sole_tutor" : "organization");
  } else if (userType === "student") {
    const purchase = await CoachingSessionPurchase.findOne({
      where: {
        session_id: sessionId,
        student_id: userId,
      },
    });
    hasAccess = !!purchase;
  }

  if (!hasAccess) {
    throw new ErrorClass("Access denied to this session", 403);
  }

  // Build query
  const where = { session_id: sessionId };
  if (before) {
    where.created_at = { [Op.lt]: new Date(before) };
  }

  // Get messages (latest first, then reverse for display)
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { rows: messages, count } = await CoachingSchedulingMessage.findAndCountAll({
    where,
    order: [["created_at", "DESC"]],
    limit: parseInt(limit),
    offset,
  });

  // Reverse to show oldest first (for pagination when scrolling up)
  const reversedMessages = messages.reverse();

  // Get sender info for each message
  const messagesWithSenders = await Promise.all(
    reversedMessages.map(async (msg) => {
      let senderInfo;
      if (msg.sender_type === "tutor") {
        if (session.tutor_type === "sole_tutor") {
          const tutor = await SoleTutor.findByPk(msg.sender_id, {
            attributes: ["id", "fname", "lname", "email"],
          });
          senderInfo = tutor
            ? {
                id: tutor.id,
                name: `${tutor.fname} ${tutor.lname}`,
                email: tutor.email,
              }
            : null;
        } else {
          const org = await Organization.findByPk(msg.sender_id, {
            attributes: ["id", "name", "email"],
          });
          senderInfo = org
            ? {
                id: org.id,
                name: org.name,
                email: org.email,
              }
            : null;
        }
      } else {
        const student = await Students.findByPk(msg.sender_id, {
          attributes: ["id", "fname", "lname", "mname", "email"],
        });
        senderInfo = student
          ? {
              id: student.id,
              name: `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim() ||
                student.email,
              email: student.email,
            }
          : null;
      }

      return {
        id: msg.id,
        session_id: msg.session_id,
        sender_id: msg.sender_id,
        sender_type: msg.sender_type,
        sender_info: senderInfo,
        message: msg.message,
        message_type: msg.message_type,
        proposed_start_time: msg.proposed_start_time,
        proposed_end_time: msg.proposed_end_time,
        status: msg.status,
        read_at: msg.read_at,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
      };
    })
  );

  res.json({
    status: true,
    code: 200,
    message: "Messages retrieved successfully",
    data: {
      messages: messagesWithSenders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
        hasMore: offset + messages.length < count,
      },
    },
  });
});

/**
 * Mark messages as read
 * PUT /api/marketplace/coaching/sessions/:sessionId/messages/read
 */
export const markMessagesAsRead = TryCatchFunction(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;
  const userType = req.user.userType;

  // Verify access
  const session = await CoachingSession.findByPk(sessionId);
  if (!session) {
    throw new ErrorClass("Session not found", 404);
  }

  let hasAccess = false;
  if (userType === "sole_tutor" || userType === "organization") {
    hasAccess =
      session.tutor_id === userId &&
      session.tutor_type ===
        (userType === "sole_tutor" ? "sole_tutor" : "organization");
  } else if (userType === "student") {
    const purchase = await CoachingSessionPurchase.findOne({
      where: {
        session_id: sessionId,
        student_id: userId,
      },
    });
    hasAccess = !!purchase;
  }

  if (!hasAccess) {
    throw new ErrorClass("Access denied", 403);
  }

  // Mark all unread messages from other users as read
  await CoachingSchedulingMessage.update(
    { read_at: new Date() },
    {
      where: {
        session_id: sessionId,
        sender_id: { [Op.ne]: userId },
        read_at: null,
      },
    }
  );

  res.json({
    status: true,
    code: 200,
    message: "Messages marked as read",
  });
});

