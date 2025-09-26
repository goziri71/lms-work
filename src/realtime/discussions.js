import { AuthService } from "../service/authservice.js";
import { Config } from "../config/config.js";
import { db } from "../database/database.js";
import {
  Discussions,
  DiscussionMessages,
} from "../models/modules/discussions.js";

const authService = new AuthService();

function roomName(courseId, academicYear, semester) {
  return `discussion:${courseId}:${academicYear}:${semester}`;
}

export function setupDiscussionsSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error("jwt must be provided"));
      const verified = await authService.verifyToken(token, Config.JWT_SECRET);
      socket.user = verified;
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on("connection", (socket) => {
    socket.on(
      "joinDiscussion",
      async ({ courseId, academicYear, semester }, cb) => {
        try {
          const userId = Number(socket.user?.id);
          const userType = socket.user?.userType;
          if (!Number.isInteger(userId) || userId <= 0)
            throw new Error("Unauthorized");

          // Access control
          let allowed = false;
          if (userType === "staff") {
            const [rows] = await db.query(
              "SELECT 1 FROM courses WHERE id = ? AND staff_id = ?",
              { replacements: [courseId, userId] }
            );
            allowed = rows.length > 0;
          } else if (userType === "student") {
            const [rows] = await db.query(
              "SELECT 1 FROM course_reg WHERE course_id = ? AND student_id = ? AND academic_year = ? AND semester = ?",
              { replacements: [courseId, userId, academicYear, semester] }
            );
            allowed = rows.length > 0;
          }
          if (!allowed) throw new Error("Forbidden");

          // Ensure discussion exists - use actual staff ID when creating
          const [discussion] = await Discussions.findOrCreate({
            where: {
              course_id: courseId,
              academic_year: academicYear,
              semester,
            },
            defaults: {
              course_id: courseId,
              academic_year: academicYear,
              semester,
              created_by_staff_id: userType === "staff" ? userId : 1, // Use actual staff ID or default to 1
            },
          });

          const room = roomName(courseId, academicYear, semester);
          socket.join(room);

          // Load recent history
          const messages = await DiscussionMessages.findAll({
            where: { discussion_id: discussion.id },
            order: [["created_at", "ASC"]],
            limit: 100,
          });
          cb?.({ ok: true, discussionId: discussion.id, messages });
        } catch (err) {
          cb?.({ ok: false, error: err.message });
        }
      }
    );

    socket.on(
      "postMessage",
      async ({ courseId, academicYear, semester, message_text }, cb) => {
        try {
          const userId = Number(socket.user?.id);
          const userType = socket.user?.userType;
          const sender_type = userType === "staff" ? "staff" : "student";
          if (!message_text) throw new Error("message_text required");

          // Re-verify access for security
          let allowed = false;
          if (userType === "staff") {
            const [rows] = await db.query(
              "SELECT 1 FROM courses WHERE id = ? AND staff_id = ?",
              { replacements: [courseId, userId] }
            );
            allowed = rows.length > 0;
          } else if (userType === "student") {
            const [rows] = await db.query(
              "SELECT 1 FROM course_reg WHERE course_id = ? AND student_id = ? AND academic_year = ? AND semester = ?",
              { replacements: [courseId, userId, academicYear, semester] }
            );
            allowed = rows.length > 0;
          }
          if (!allowed) throw new Error("Forbidden");

          const discussion = await Discussions.findOne({
            where: {
              course_id: courseId,
              academic_year: academicYear,
              semester,
            },
          });
          if (!discussion) throw new Error("Discussion not found");

          const msg = await DiscussionMessages.create({
            discussion_id: discussion.id,
            sender_type,
            sender_id: userId,
            message_text,
          });

          const payload = {
            id: msg.id,
            discussion_id: discussion.id,
            sender_type,
            sender_id: userId,
            message_text,
            created_at: msg.created_at,
          };
          io.to(roomName(courseId, academicYear, semester)).emit(
            "newMessage",
            payload
          );
          cb?.({ ok: true, message: payload });
        } catch (err) {
          cb?.({ ok: false, error: err.message });
        }
      }
    );

    socket.on(
      "loadMoreMessages",
      async (
        { courseId, academicYear, semester, beforeMessageId, limit = 50 },
        cb
      ) => {
        try {
          const userId = Number(socket.user?.id);
          const userType = socket.user?.userType;
          if (!Number.isInteger(userId) || userId <= 0)
            throw new Error("Unauthorized");

          // Access control
          let allowed = false;
          if (userType === "staff") {
            const [rows] = await db.query(
              "SELECT 1 FROM courses WHERE id = ? AND staff_id = ?",
              { replacements: [courseId, userId] }
            );
            allowed = rows.length > 0;
          } else if (userType === "student") {
            const [rows] = await db.query(
              "SELECT 1 FROM course_reg WHERE course_id = ? AND student_id = ? AND academic_year = ? AND semester = ?",
              { replacements: [courseId, userId, academicYear, semester] }
            );
            allowed = rows.length > 0;
          }
          if (!allowed) throw new Error("Forbidden");

          // Find the discussion
          const discussion = await Discussions.findOne({
            where: {
              course_id: courseId,
              academic_year: academicYear,
              semester,
            },
          });
          if (!discussion) throw new Error("Discussion not found");

          // Build where clause for pagination
          const whereClause = { discussion_id: discussion.id };
          if (beforeMessageId) {
            whereClause.id = { [db.Sequelize.Op.lt]: beforeMessageId };
          }

          // Fetch older messages
          const messages = await DiscussionMessages.findAll({
            where: whereClause,
            order: [["created_at", "ASC"]],
            limit: Math.min(limit, 100), // Cap at 100 messages per request
          });

          cb?.({
            ok: true,
            messages,
            hasMore: messages.length === limit, // Indicates if there might be more messages
          });
        } catch (err) {
          cb?.({ ok: false, error: err.message });
        }
      }
    );
  });
}
