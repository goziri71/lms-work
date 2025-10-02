import { AuthService } from "../service/authservice.js";
import { Config } from "../config/config.js";
import { DirectMessage } from "../models/chat/directMessage.js";

const authService = new AuthService();

function dmRoom(userAId, userBId) {
  const a = Number(userAId);
  const b = Number(userBId);
  const [minId, maxId] = a < b ? [a, b] : [b, a];
  return `dm:${minId}-${maxId}`;
}

function dmRoomKey(userAId, userBId) {
  const a = Number(userAId);
  const b = Number(userBId);
  const [minId, maxId] = a < b ? [a, b] : [b, a];
  return `${minId}-${maxId}`;
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
    // Basic presence: let peers know this user is online
    try {
      const onlineUserId = Number(socket.user?.id);
      if (Number.isInteger(onlineUserId) && onlineUserId > 0) {
        io.emit("dm:online", { userId: onlineUserId, isOnline: true });
      }
    } catch {}

    socket.on("dm:join", async ({ peerUserId }, cb) => {
      try {
        const userId = Number(socket.user?.id);
        if (!Number.isInteger(userId) || userId <= 0)
          throw new Error("Unauthorized");
        const room = dmRoom(userId, peerUserId);
        socket.join(room);

        const roomKey = dmRoomKey(userId, peerUserId);
        const messages = await DirectMessage.find({ roomKey })
          .sort({ created_at: 1 })
          .limit(100)
          .lean();

        cb?.({ ok: true, messages });
      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // Typing indicator
    socket.on("dm:typing", ({ peerUserId, isTyping = true }) => {
      try {
        const userId = Number(socket.user?.id);
        if (!Number.isInteger(userId) || userId <= 0) return;
        const room = dmRoom(userId, peerUserId);
        // Notify the peer only
        socket.to(room).emit("dm:typing", {
          userId,
          peerUserId: Number(peerUserId),
          isTyping: Boolean(isTyping),
        });
      } catch {}
    });

    socket.on("dm:send", async ({ peerUserId, message_text }, cb) => {
      try {
        const userId = Number(socket.user?.id);
        if (!Number.isInteger(userId) || userId <= 0)
          throw new Error("Unauthorized");
        if (!message_text) throw new Error("message_text required");

        const roomKey = dmRoomKey(userId, peerUserId);
        const created = await DirectMessage.create({
          roomKey,
          senderId: userId,
          receiverId: Number(peerUserId),
          messageText: message_text,
        });

        const payload = {
          id: created._id,
          sender_id: userId,
          receiver_id: Number(peerUserId),
          message_text: message_text,
          created_at: created.created_at,
          delivered_at: null,
          read_at: null,
        };

        const room = dmRoom(userId, peerUserId);
        io.to(room).emit("dm:newMessage", payload);
        cb?.({ ok: true, message: payload });
      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // Mark delivered
    socket.on("dm:delivered", async ({ messageId }, cb) => {
      try {
        const userId = Number(socket.user?.id);
        if (!Number.isInteger(userId) || userId <= 0)
          throw new Error("Unauthorized");
        const msg = await DirectMessage.findById(messageId);
        if (!msg) throw new Error("Message not found");
        // Only receiver can mark delivered
        if (msg.receiverId !== userId) throw new Error("Forbidden");
        if (!msg.deliveredAt) {
          msg.deliveredAt = new Date();
          await msg.save();
        }
        const room = dmRoom(msg.senderId, msg.receiverId);
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
        if (msg.receiverId !== userId) throw new Error("Forbidden");
        if (!msg.readAt) {
          msg.readAt = new Date();
          await msg.save();
        }
        const room = dmRoom(msg.senderId, msg.receiverId);
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
      async ({ peerUserId, beforeMessageId, limit = 50 }, cb) => {
        try {
          const userId = Number(socket.user?.id);
          if (!Number.isInteger(userId) || userId <= 0)
            throw new Error("Unauthorized");

          const roomKey = dmRoomKey(userId, peerUserId);
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
            receiver_id: m.receiverId,
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
