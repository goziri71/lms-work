/**
 * Socket.io handler for One-on-One Coaching Scheduling Messages
 * Real-time messaging between tutors and learners for scheduling
 */

import { AuthService } from "../service/authservice.js";
import { Config } from "../config/config.js";

const authService = new AuthService();
import { CoachingSchedulingMessage } from "../models/marketplace/coachingSchedulingMessage.js";
import { CoachingSession } from "../models/marketplace/coachingSession.js";
import { CoachingSessionPurchase } from "../models/marketplace/coachingSessionPurchase.js";
import { Students } from "../models/auth/student.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";
import { emailService } from "../services/emailService.js";

/**
 * Setup coaching messaging socket handlers
 * @param {SocketIOServer} io - Socket.io server instance
 */
export function setupCoachingMessagingSocket(io) {
  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
      
      if (!token) {
        return next(new Error("Authentication token required"));
      }

      const decoded = await authService.verifyToken(token, Config.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userType = decoded.userType;
      
      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Coaching messaging socket connected: ${socket.userId} (${socket.userType})`);

    // Join session room
    socket.on("join_session", async (data) => {
      try {
        const { sessionId } = data;
        
        // Verify user has access to this session
        const hasAccess = await verifySessionAccess(sessionId, socket.userId, socket.userType);
        
        if (!hasAccess) {
          socket.emit("error", { message: "Access denied to this session" });
          return;
        }

        const room = `coaching_session_${sessionId}`;
        socket.join(room);
        socket.currentSessionId = sessionId;
        
        socket.emit("joined_session", { sessionId, room });
        
        // Notify others in room
        socket.to(room).emit("user_joined", {
          userId: socket.userId,
          userType: socket.userType,
        });
      } catch (error) {
        socket.emit("error", { message: "Failed to join session" });
      }
    });

    // Send message
    socket.on("send_message", async (data) => {
      try {
        const { sessionId, message, proposedStartTime, proposedEndTime } = data;
        
        if (!sessionId || (!message && !proposedStartTime)) {
          socket.emit("error", { message: "Message or time proposal required" });
          return;
        }

        // Verify access
        const hasAccess = await verifySessionAccess(sessionId, socket.userId, socket.userType);
        if (!hasAccess) {
          socket.emit("error", { message: "Access denied" });
          return;
        }

        // Get session
        const session = await CoachingSession.findByPk(sessionId);
        if (!session || session.session_type !== "one_on_one") {
          socket.emit("error", { message: "Invalid session" });
          return;
        }

        // Determine sender type
        let senderType;
        if (socket.userType === "sole_tutor" || socket.userType === "organization") {
          senderType = "tutor";
          // Verify it's the session tutor
          if (session.tutor_id !== socket.userId || session.tutor_type !== (socket.userType === "sole_tutor" ? "sole_tutor" : "organization")) {
            socket.emit("error", { message: "Access denied" });
            return;
          }
        } else if (socket.userType === "student") {
          senderType = "learner";
          // Verify student has purchased
          const purchase = await CoachingSessionPurchase.findOne({
            where: {
              session_id: sessionId,
              student_id: socket.userId,
            },
          });
          if (!purchase) {
            socket.emit("error", { message: "Access denied" });
            return;
          }
        } else {
          socket.emit("error", { message: "Invalid user type" });
          return;
        }

        // Determine message type
        const messageType = proposedStartTime ? "time_proposal" : "text";

        // Create message
        const schedulingMessage = await CoachingSchedulingMessage.create({
          session_id: sessionId,
          sender_id: socket.userId,
          sender_type: senderType,
          message: message || null,
          message_type: messageType,
          proposed_start_time: proposedStartTime || null,
          proposed_end_time: proposedEndTime || null,
          status: messageType === "time_proposal" ? "pending" : "pending",
        });

        // Get sender info for response
        let senderInfo;
        if (senderType === "tutor") {
          if (session.tutor_type === "sole_tutor") {
            const tutor = await SoleTutor.findByPk(socket.userId, {
              attributes: ["id", "fname", "lname", "email"],
            });
            senderInfo = {
              id: tutor.id,
              name: `${tutor.fname} ${tutor.lname}`,
              email: tutor.email,
            };
          } else {
            const org = await Organization.findByPk(socket.userId, {
              attributes: ["id", "name", "email"],
            });
            senderInfo = {
              id: org.id,
              name: org.name,
              email: org.email,
            };
          }
        } else {
          const student = await Students.findByPk(socket.userId, {
            attributes: ["id", "fname", "lname", "mname", "email"],
          });
          senderInfo = {
            id: student.id,
            name: `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim() || student.email,
            email: student.email,
          };
        }

        // Prepare message response
        const messageData = {
          id: schedulingMessage.id,
          session_id: sessionId,
          sender_id: socket.userId,
          sender_type: senderType,
          sender_info: senderInfo,
          message: schedulingMessage.message,
          message_type: messageType,
          proposed_start_time: schedulingMessage.proposed_start_time,
          proposed_end_time: schedulingMessage.proposed_end_time,
          status: schedulingMessage.status,
          created_at: schedulingMessage.created_at,
        };

        // Broadcast to room
        const room = `coaching_session_${sessionId}`;
        io.to(room).emit("new_message", messageData);

        // Send email notification to recipient
        await sendMessageNotification(sessionId, senderType, messageData);
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Accept time proposal
    socket.on("accept_time_proposal", async (data) => {
      try {
        const { sessionId, messageId } = data;
        
        // Verify access
        const hasAccess = await verifySessionAccess(sessionId, socket.userId, socket.userType);
        if (!hasAccess) {
          socket.emit("error", { message: "Access denied" });
          return;
        }

        // Get message
        const schedulingMessage = await CoachingSchedulingMessage.findByPk(messageId, {
          where: {
            session_id: sessionId,
            message_type: "time_proposal",
            status: "pending",
          },
        });

        if (!schedulingMessage) {
          socket.emit("error", { message: "Time proposal not found" });
          return;
        }

        // Verify user is the recipient (not the sender)
        if (schedulingMessage.sender_id === socket.userId) {
          socket.emit("error", { message: "Cannot accept your own proposal" });
          return;
        }

        // Update message status
        await schedulingMessage.update({ status: "accepted" });

        // Update session with agreed time
        const session = await CoachingSession.findByPk(sessionId);
        await session.update({
          agreed_start_time: schedulingMessage.proposed_start_time,
          agreed_end_time: schedulingMessage.proposed_end_time,
          scheduling_status: "scheduled",
          start_time: schedulingMessage.proposed_start_time,
          end_time: schedulingMessage.proposed_end_time,
        });

        // Create Stream.io call if not exists
        if (!session.stream_call_id) {
          const { streamVideoService } = await import("../service/streamVideoService.js");
          const streamCall = await streamVideoService.createCall({
            createdBy: String(session.tutor_id),
            record: false,
            startsAt: schedulingMessage.proposed_start_time.toISOString(),
          });
          
          const viewLink = `${Config.frontendUrl}/coaching/session/${streamCall.id}`;
          await session.update({
            stream_call_id: streamCall.id,
            view_link: viewLink,
          });
        }

        // Broadcast acceptance
        const room = `coaching_session_${sessionId}`;
        io.to(room).emit("time_proposal_accepted", {
          messageId,
          sessionId,
          agreed_start_time: schedulingMessage.proposed_start_time,
          agreed_end_time: schedulingMessage.proposed_end_time,
        });

        // Send email to both parties
        await sendTimeAgreedNotification(sessionId);
      } catch (error) {
        console.error("Error accepting time proposal:", error);
        socket.emit("error", { message: "Failed to accept time proposal" });
      }
    });

    // Reject time proposal
    socket.on("reject_time_proposal", async (data) => {
      try {
        const { sessionId, messageId, reason } = data;
        
        // Verify access
        const hasAccess = await verifySessionAccess(sessionId, socket.userId, socket.userType);
        if (!hasAccess) {
          socket.emit("error", { message: "Access denied" });
          return;
        }

        // Get message
        const schedulingMessage = await CoachingSchedulingMessage.findByPk(messageId, {
          where: {
            session_id: sessionId,
            message_type: "time_proposal",
            status: "pending",
          },
        });

        if (!schedulingMessage) {
          socket.emit("error", { message: "Time proposal not found" });
          return;
        }

        // Verify user is the recipient
        if (schedulingMessage.sender_id === socket.userId) {
          socket.emit("error", { message: "Cannot reject your own proposal" });
          return;
        }

        // Update message status
        await schedulingMessage.update({ status: "rejected" });

        // Broadcast rejection
        const room = `coaching_session_${sessionId}`;
        io.to(room).emit("time_proposal_rejected", {
          messageId,
          sessionId,
          reason: reason || null,
        });

        // Send email notification
        await sendTimeRejectedNotification(sessionId, messageId, reason);
      } catch (error) {
        console.error("Error rejecting time proposal:", error);
        socket.emit("error", { message: "Failed to reject time proposal" });
      }
    });

    // Mark message as read
    socket.on("mark_message_read", async (data) => {
      try {
        const { messageId } = data;
        const message = await CoachingSchedulingMessage.findByPk(messageId);
        
        if (message && message.sender_id !== socket.userId) {
          await message.update({ read_at: new Date() });
        }
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    });

    // Leave session room
    socket.on("leave_session", () => {
      if (socket.currentSessionId) {
        const room = `coaching_session_${socket.currentSessionId}`;
        socket.leave(room);
        socket.currentSessionId = null;
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log(`Coaching messaging socket disconnected: ${socket.userId}`);
    });
  });
}

/**
 * Verify user has access to session
 */
async function verifySessionAccess(sessionId, userId, userType) {
  const session = await CoachingSession.findByPk(sessionId);
  if (!session) return false;

  // Tutor access
  if (userType === "sole_tutor" || userType === "organization") {
    return (
      session.tutor_id === userId &&
      session.tutor_type === (userType === "sole_tutor" ? "sole_tutor" : "organization")
    );
  }

  // Student access (must have purchased)
  if (userType === "student") {
    const purchase = await CoachingSessionPurchase.findOne({
      where: {
        session_id: sessionId,
        student_id: userId,
      },
    });
    return !!purchase;
  }

  return false;
}

/**
 * Send email notification for new message
 */
async function sendMessageNotification(sessionId, senderType, messageData) {
  try {
    const session = await CoachingSession.findByPk(sessionId, {
      include: [
        {
          model: CoachingSessionPurchase,
          as: "purchases",
          include: [
            {
              model: Students,
              as: "student",
              attributes: ["id", "fname", "lname", "mname", "email"],
            },
          ],
        },
      ],
    });

    if (!session) return;

    // Get recipient info
    let recipientEmail, recipientName;
    if (senderType === "tutor") {
      // Send to learner
      const purchase = session.purchases?.[0];
      if (purchase?.student) {
        recipientEmail = purchase.student.email;
        recipientName = `${purchase.student.fname || ""} ${purchase.student.mname || ""} ${purchase.student.lname || ""}`.trim() || purchase.student.email;
      }
    } else {
      // Send to tutor
      if (session.tutor_type === "sole_tutor") {
        const tutor = await SoleTutor.findByPk(session.tutor_id, {
          attributes: ["fname", "lname", "email"],
        });
        if (tutor) {
          recipientEmail = tutor.email;
          recipientName = `${tutor.fname} ${tutor.lname}`;
        }
      } else {
        const org = await Organization.findByPk(session.tutor_id, {
          attributes: ["name", "email"],
        });
        if (org) {
          recipientEmail = org.email;
          recipientName = org.name;
        }
      }
    }

    if (recipientEmail) {
      await emailService.sendEmail({
        to: recipientEmail,
        name: recipientName,
        subject: `New Message - ${session.title}`,
        htmlBody: `
          <p>You have a new message regarding your coaching session: <strong>${session.title}</strong></p>
          ${messageData.message ? `<p>Message: ${messageData.message}</p>` : ""}
          ${messageData.proposed_start_time ? `<p>Proposed Time: ${new Date(messageData.proposed_start_time).toLocaleString()}</p>` : ""}
          <p><a href="${Config.frontendUrl}/coaching/session/${sessionId}/messages">View Message</a></p>
        `,
      });
    }
  } catch (error) {
    console.error("Error sending message notification:", error);
  }
}

/**
 * Send email when time is agreed
 */
async function sendTimeAgreedNotification(sessionId) {
  try {
    const session = await CoachingSession.findByPk(sessionId, {
      include: [
        {
          model: CoachingSessionPurchase,
          as: "purchases",
          include: [
            {
              model: Students,
              as: "student",
              attributes: ["fname", "lname", "mname", "email"],
            },
          ],
        },
      ],
    });

    if (!session || !session.agreed_start_time) return;

    // Get tutor info
    let tutorEmail, tutorName;
    if (session.tutor_type === "sole_tutor") {
      const tutor = await SoleTutor.findByPk(session.tutor_id, {
        attributes: ["fname", "lname", "email"],
      });
      if (tutor) {
        tutorEmail = tutor.email;
        tutorName = `${tutor.fname} ${tutor.lname}`;
      }
    } else {
      const org = await Organization.findByPk(session.tutor_id, {
        attributes: ["name", "email"],
      });
      if (org) {
        tutorEmail = org.email;
        tutorName = org.name;
      }
    }

    // Send to tutor
    if (tutorEmail) {
      await emailService.sendEmail({
        to: tutorEmail,
        name: tutorName,
        subject: `Coaching Session Scheduled - ${session.title}`,
        htmlBody: `
          <h2>Coaching Session Scheduled</h2>
          <p><strong>Session:</strong> ${session.title}</p>
          <p><strong>Start Time:</strong> ${new Date(session.agreed_start_time).toLocaleString()}</p>
          <p><strong>End Time:</strong> ${new Date(session.agreed_end_time).toLocaleString()}</p>
          <p><strong>Duration:</strong> ${session.duration_minutes} minutes</p>
          ${session.view_link ? `<p><a href="${session.view_link}">Join Session</a></p>` : ""}
        `,
      });
    }

    // Send to learner
    const purchase = session.purchases?.[0];
    if (purchase?.student) {
      const learnerName = `${purchase.student.fname || ""} ${purchase.student.mname || ""} ${purchase.student.lname || ""}`.trim() || purchase.student.email;
      await emailService.sendEmail({
        to: purchase.student.email,
        name: learnerName,
        subject: `Coaching Session Scheduled - ${session.title}`,
        htmlBody: `
          <h2>Coaching Session Scheduled</h2>
          <p><strong>Session:</strong> ${session.title}</p>
          <p><strong>Tutor:</strong> ${tutorName}</p>
          <p><strong>Start Time:</strong> ${new Date(session.agreed_start_time).toLocaleString()}</p>
          <p><strong>End Time:</strong> ${new Date(session.agreed_end_time).toLocaleString()}</p>
          <p><strong>Duration:</strong> ${session.duration_minutes} minutes</p>
          ${session.view_link ? `<p><a href="${session.view_link}">Join Session</a></p>` : ""}
        `,
      });
    }
  } catch (error) {
    console.error("Error sending time agreed notification:", error);
  }
}

/**
 * Send email when time proposal is rejected
 */
async function sendTimeRejectedNotification(sessionId, messageId, reason) {
  try {
    const message = await CoachingSchedulingMessage.findByPk(messageId);
    if (!message) return;

    const session = await CoachingSession.findByPk(sessionId);
    if (!session) return;

    // Get sender info
    let senderEmail, senderName;
    if (message.sender_type === "tutor") {
      if (session.tutor_type === "sole_tutor") {
        const tutor = await SoleTutor.findByPk(message.sender_id, {
          attributes: ["fname", "lname", "email"],
        });
        if (tutor) {
          senderEmail = tutor.email;
          senderName = `${tutor.fname} ${tutor.lname}`;
        }
      } else {
        const org = await Organization.findByPk(message.sender_id, {
          attributes: ["name", "email"],
        });
        if (org) {
          senderEmail = org.email;
          senderName = org.name;
        }
      }
    } else {
      const student = await Students.findByPk(message.sender_id, {
        attributes: ["fname", "lname", "mname", "email"],
      });
      if (student) {
        senderEmail = student.email;
        senderName = `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim() || student.email;
      }
    }

    if (senderEmail) {
      await emailService.sendEmail({
        to: senderEmail,
        name: senderName,
        subject: `Time Proposal Rejected - ${session.title}`,
        htmlBody: `
          <p>Your time proposal for <strong>${session.title}</strong> has been rejected.</p>
          ${reason ? `<p>Reason: ${reason}</p>` : ""}
          <p>Please propose a different time or discuss with the other party.</p>
          <p><a href="${Config.frontendUrl}/coaching/session/${sessionId}/messages">View Messages</a></p>
        `,
      });
    }
  } catch (error) {
    console.error("Error sending rejection notification:", error);
  }
}

