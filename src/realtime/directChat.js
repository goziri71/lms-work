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
        };

        const room = dmRoom(userId, peerUserId);
        io.to(room).emit("dm:newMessage", payload);
        cb?.({ ok: true, message: payload });
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
  });
}
