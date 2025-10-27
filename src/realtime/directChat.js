import { AuthService } from "../service/authservice.js";
import { Config } from "../config/config.js";
import { DirectMessage } from "../models/chat/directMessage.js";
import {
  getCachedMessages,
  cacheMessages,
  getChatKey,
  invalidateChatCache,
} from "../utils/chatCache.js";

const authService = new AuthService();

// Track online users (userId -> socketId)
const onlineUsers = new Map();

function composite(userType, userId) {
  return `${String(userType)}:${Number(userId)}`;
}

function sortComposite(a, b) {
  return a.localeCompare(b) <= 0 ? [a, b] : [b, a];
}

function dmRoom(userAType, userAId, userBType, userBId) {
  const ca = composite(userAType, userAId);
  const cb = composite(userBType, userBId);
  const [minC, maxC] = sortComposite(ca, cb);
  return `dm:${minC}-${maxC}`;
}

function dmRoomKey(userAType, userAId, userBType, userBId) {
  const ca = composite(userAType, userAId);
  const cb = composite(userBType, userBId);
  const [minC, maxC] = sortComposite(ca, cb);
  return `${minC}-${maxC}`;
}

export function setupDirectChatSocket(io) {
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
    // Track user as online
    const userId = Number(socket.user?.id);
    const userType = socket.user?.userType;

    if (Number.isInteger(userId) && userId > 0) {
      onlineUsers.set(userId, socket.id);

      // Notify all clients that this user is now online
      io.emit("dm:online", {
        userId,
        userType,
        isOnline: true,
      });
    }

    // Handle disconnect
    socket.on("disconnect", () => {
      if (Number.isInteger(userId) && userId > 0) {
        onlineUsers.delete(userId);

        // Notify all clients that this user is now offline
        io.emit("dm:online", {
          userId,
          userType,
          isOnline: false,
        });
      }
    });

    // Allow clients to check if a user is online
    socket.on("dm:checkOnline", ({ userIds }, cb) => {
      if (!Array.isArray(userIds)) {
        cb?.({ ok: false, error: "userIds must be an array" });
        return;
      }

      const onlineStatus = userIds.map((uid) => ({
        userId: uid,
        isOnline: onlineUsers.has(Number(uid)),
      }));

      cb?.({ ok: true, status: onlineStatus });
    });

    socket.on("dm:join", async ({ peerUserId, peerUserType }, cb) => {
      try {
        const userId = Number(socket.user?.id);
        const userType = socket.user?.userType;
        if (!Number.isInteger(userId) || userId <= 0)
          throw new Error("Unauthorized");

        // Leave all previous DM rooms first to avoid message leakage
        const allRooms = Array.from(socket.rooms);
        allRooms.forEach((room) => {
          if (room.startsWith("dm:")) {
            socket.leave(room);
          }
        });

        const room = dmRoom(userType, userId, peerUserType, peerUserId);
        socket.join(room);

        const roomKey = dmRoomKey(userType, userId, peerUserType, peerUserId);

        // Always fetch from database for now (cache disabled for safety)
        const mongoMessages = await DirectMessage.find({ roomKey })
          .sort({ created_at: -1 })
          .limit(100)
          .lean();

        const messages = mongoMessages.map((m) => ({
          id: m._id,
          sender_id: m.senderId,
          sender_type: m.senderType,
          receiver_id: m.receiverId,
          receiver_type: m.receiverType,
          message_text: m.messageText,
          created_at: m.created_at,
          delivered_at: m.deliveredAt || null,
          read_at: m.readAt || null,
        }));

        // Auto-mark all unread messages as read when joining chat
        const unreadMessages = messages.filter(
          (m) => m.receiver_id === userId && !m.read_at
        );

        if (unreadMessages.length > 0) {
          for (const msg of unreadMessages) {
            await DirectMessage.findByIdAndUpdate(msg.id, {
              readAt: new Date(),
            });
          }

          // Invalidate chat list cache for BOTH users (sender and receiver)
          await invalidateChatListCache(userId);
          await invalidateChatListCache(peerUserId);

          // Notify sender that messages were read
          const room = dmRoom(userType, userId, peerUserType, peerUserId);
          io.to(room).emit("dm:read", {
            messageId: unreadMessages[0].id,
            read_at: new Date(),
          });
        }

        cb?.({ ok: true, messages });
      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // Typing indicator
    socket.on("dm:typing", ({ peerUserId, peerUserType, isTyping = true }) => {
      try {
        const userId = Number(socket.user?.id);
        const userType = socket.user?.userType;
        if (!Number.isInteger(userId) || userId <= 0) return;
        const room = dmRoom(userType, userId, peerUserType, peerUserId);
        // Notify the peer only
        socket.to(room).emit("dm:typing", {
          userId,
          userType,
          peerUserId: Number(peerUserId),
          peerUserType,
          isTyping: Boolean(isTyping),
        });
      } catch {}
    });

    socket.on(
      "dm:send",
      async ({ peerUserId, peerUserType, message_text }, cb) => {
        try {
          const userId = Number(socket.user?.id);
          const userType = socket.user?.userType;
          if (!Number.isInteger(userId) || userId <= 0)
            throw new Error("Unauthorized");
          if (!message_text) throw new Error("message_text required");

          const roomKey = dmRoomKey(userType, userId, peerUserType, peerUserId);
          const created = await DirectMessage.create({
            roomKey,
            senderType: userType,
            senderId: userId,
            receiverType: peerUserType,
            receiverId: Number(peerUserId),
            messageText: message_text,
          });

          const payload = {
            id: created._id,
            sender_id: userId,
            sender_type: userType,
            receiver_id: Number(peerUserId),
            receiver_type: peerUserType,
            message_text: message_text,
            created_at: created.created_at,
            delivered_at: null,
            read_at: null,
          };

          const room = dmRoom(userType, userId, peerUserType, peerUserId);
          io.to(room).emit("dm:newMessage", payload);
          cb?.({ ok: true, message: payload });
        } catch (err) {
          cb?.({ ok: false, error: err.message });
        }
      }
    );

    // Mark delivered
    socket.on("dm:delivered", async ({ messageId }, cb) => {
      try {
        const userId = Number(socket.user?.id);
        if (!Number.isInteger(userId) || userId <= 0)
          throw new Error("Unauthorized");
        const msg = await DirectMessage.findById(messageId);
        if (!msg) throw new Error("Message not found");
        // Only receiver can mark delivered
        if (Number(msg.receiverId) !== userId) throw new Error("Forbidden");
        if (!msg.deliveredAt) {
          msg.deliveredAt = new Date();
          await msg.save();
        }
        const room = dmRoom(
          msg.senderType,
          msg.senderId,
          msg.receiverType,
          msg.receiverId
        );
        io.to(room).emit("dm:delivered", {
          messageId: msg._id,
          delivered_at: msg.deliveredAt,
        });
        cb?.({ ok: true });
      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // Mark read
    socket.on("dm:read", async ({ messageId }, cb) => {
      try {
        const userId = Number(socket.user?.id);
        if (!Number.isInteger(userId) || userId <= 0)
          throw new Error("Unauthorized");
        const msg = await DirectMessage.findById(messageId);
        if (!msg) throw new Error("Message not found");
        // Only receiver can mark read
        if (Number(msg.receiverId) !== userId) throw new Error("Forbidden");
        if (!msg.readAt) {
          msg.readAt = new Date();
          await msg.save();

          // Invalidate chat list cache for BOTH users
          await invalidateChatListCache(userId);
          await invalidateChatListCache(msg.senderId);
        }
        const room = dmRoom(
          msg.senderType,
          msg.senderId,
          msg.receiverType,
          msg.receiverId
        );
        io.to(room).emit("dm:read", {
          messageId: msg._id,
          read_at: msg.readAt,
        });
        cb?.({ ok: true });
      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    socket.on(
      "dm:loadMore",
      async ({ peerUserId, peerUserType, beforeMessageId, limit = 50 }, cb) => {
        try {
          const userId = Number(socket.user?.id);
          const userType = socket.user?.userType;
          if (!Number.isInteger(userId) || userId <= 0)
            throw new Error("Unauthorized");

          const roomKey = dmRoomKey(userType, userId, peerUserType, peerUserId);
          const query = { roomKey };
          if (beforeMessageId) {
            query._id = { $lt: beforeMessageId };
          }

          const mongoMessages = await DirectMessage.find(query)
            .sort({ created_at: 1 })
            .limit(Math.min(limit, 100))
            .lean();

          const messages = mongoMessages.map((m) => ({
            id: m._id,
            sender_id: m.senderId,
            sender_type: m.senderType,
            receiver_id: m.receiverId,
            receiver_type: m.receiverType,
            message_text: m.messageText,
            created_at: m.created_at,
          }));

          cb?.({ ok: true, messages, hasMore: mongoMessages.length === limit });
        } catch (err) {
          cb?.({ ok: false, error: err.message });
        }
      }
    );

    // Presence: notify offline on disconnect
    socket.on("disconnect", () => {
      try {
        const offlineUserId = Number(socket.user?.id);
        if (Number.isInteger(offlineUserId) && offlineUserId > 0) {
          io.emit("dm:online", { userId: offlineUserId, isOnline: false });
        }
      } catch {}
    });
  });
}
