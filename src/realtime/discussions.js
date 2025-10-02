import { AuthService } from "../service/authservice.js";
import { Config } from "../config/config.js";
import { db } from "../database/database.js";
import { Discussions } from "../models/modules/discussions.js";
import { DiscussionMessage } from "../models/chat/discussionMessage.js";
import mongoose from "mongoose";

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

          console.log("🔍 DEBUG User joined room:", {
            userId,
            userType,
            room,
            socketId: socket.id,
            roomClients: io.sockets.adapter.rooms.get(room)?.size || 0,
          });

          // Check MongoDB connection
          if (mongoose.connection.readyState !== 1) {
            throw new Error(
              "MongoDB not connected. Check MONGO_URI and restart server."
            );
          }

          // Load recent history from MongoDB
          const mongoMessages = await DiscussionMessage.find({
            courseId,
            academicYear,
            semester,
          })
            .sort({ created_at: 1 })
            .limit(100)
            .maxTimeMS(2000)
            .lean();

          const messages = mongoMessages.map((m) => ({
            id: m._id,
            discussion_id: discussion.id,
            sender_type: m.senderType,
            sender_id: m.senderId,
            message_text: m.messageText,
            created_at: m.created_at,
          }));

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

          // Debug logging
          console.log("🔍 DEBUG postMessage:", {
            userId,
            userType,
            courseId,
            academicYear,
            semester,
            message_text: message_text?.substring(0, 50) + "...",
            userIdType: typeof userId,
            courseIdType: typeof courseId,
          });

          if (!message_text) throw new Error("message_text required");

          // Re-verify access for security
          let allowed = false;
          if (userType === "staff") {
            const [rows] = await db.query(
              "SELECT 1 FROM courses WHERE id = ? AND staff_id = ?",
              { replacements: [courseId, userId] }
            );
            allowed = rows.length > 0;
            console.log("🔍 DEBUG staff access check:", {
              courseId,
              userId,
              rowsFound: rows.length,
              allowed,
            });
          } else if (userType === "student") {
            const [rows] = await db.query(
              "SELECT 1 FROM course_reg WHERE course_id = ? AND student_id = ? AND academic_year = ? AND semester = ?",
              { replacements: [courseId, userId, academicYear, semester] }
            );
            allowed = rows.length > 0;
            console.log("🔍 DEBUG student access check:", {
              courseId,
              userId,
              academicYear,
              semester,
              rowsFound: rows.length,
              allowed,
            });
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

          // Check MongoDB connection
          if (mongoose.connection.readyState !== 1) {
            throw new Error(
              "MongoDB not connected. Check MONGO_URI and restart server."
            );
          }

          // Persist message to MongoDB
          const created = await DiscussionMessage.create({
            courseId,
            academicYear,
            semester,
            senderType: sender_type,
            senderId: userId,
            messageText: message_text,
          });

          const payload = {
            id: created._id,
            discussion_id: discussion.id,
            sender_type,
            sender_id: userId,
            message_text: message_text,
            created_at: created.created_at,
          };

          const room = roomName(courseId, academicYear, semester);
          console.log("🔍 DEBUG Broadcasting message:", {
            room,
            payload,
            roomClients: io.sockets.adapter.rooms.get(room)?.size || 0,
          });

          io.to(room).emit("newMessage", payload);
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

          // Check MongoDB connection
          if (mongoose.connection.readyState !== 1) {
            throw new Error(
              "MongoDB not connected. Check MONGO_URI and restart server."
            );
          }

          // Pagination via MongoDB
          const query = {
            courseId,
            academicYear,
            semester,
          };
          if (beforeMessageId) {
            query._id = { $lt: beforeMessageId };
          }

          const mongoMessages = await DiscussionMessage.find(query)
            .sort({ created_at: 1 })
            .limit(Math.min(limit, 100))
            .maxTimeMS(2000)
            .lean();

          const messages = mongoMessages.map((m) => ({
            id: m._id,
            discussion_id: discussion.id,
            sender_type: m.senderType,
            sender_id: m.senderId,
            message_text: m.messageText,
            created_at: m.created_at,
          }));

          cb?.({ ok: true, messages, hasMore: mongoMessages.length === limit });
        } catch (err) {
          cb?.({ ok: false, error: err.message });
        }
      }
    );
  });
}
