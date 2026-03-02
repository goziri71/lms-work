import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { DirectMessage } from "../../models/chat/directMessage.js";
import { Staff } from "../../models/auth/staff.js";
import { Students } from "../../models/auth/student.js";
import { Op } from "sequelize";
import {
  cacheChatList,
  getCachedChatList,
  cacheMessages,
  getCachedMessages,
  getChatKey,
  invalidateChatList,
  invalidateChatCache,
} from "../../utils/chatCache.js";

// GET /api/chat/dm/threads?page=&limit=&search=
// Returns recent 1:1 threads for the authenticated user (student or staff)
export const getRecentDMThreads = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;
  const search = (req.query.search || "").trim();

  // Try to get from cache first (only for first page, no search)
  if (page === 1 && !search) {
    const cachedList = await getCachedChatList(userId);
    if (cachedList) {
      return res.status(200).json({
        status: true,
        code: 200,
        message: "Recent threads fetched successfully (cached)",
        data: cachedList,
      });
    }
  }

  // Aggregate threads grouped by peerId only (avoids duplicate threads when peerType is null)
  // Exclude self-messages (senderId === receiverId)
  const pipeline = [
    {
      $match: {
        $and: [
          { $or: [{ senderId: userId }, { receiverId: userId }] },
          { $expr: { $ne: ["$senderId", "$receiverId"] } },
        ],
      },
    },
    {
      $addFields: {
        peerId: {
          $cond: [{ $eq: ["$senderId", userId] }, "$receiverId", "$senderId"],
        },
        peerType: {
          $cond: [
            { $eq: ["$senderId", userId] },
            "$receiverType",
            "$senderType",
          ],
        },
        isUnreadForUser: {
          $and: [{ $eq: ["$receiverId", userId] }, { $eq: ["$readAt", null] }],
        },
      },
    },
    { $sort: { created_at: -1 } },
    {
      $group: {
        _id: "$peerId",
        lastMessage: { $first: "$$ROOT" },
        unreadCount: { $sum: { $cond: ["$isUnreadForUser", 1, 0] } },
      },
    },
    { $sort: { "lastMessage.created_at": -1 } },
    { $skip: skip },
    { $limit: limit },
  ];

  const grouped = await DirectMessage.aggregate(pipeline).exec();
  const peerIds = grouped.map((g) => g._id);

  // Collect all user IDs we need for lookups (peers + current user for deriving types)
  const allIds = [...new Set([...peerIds, userId])];

  // Fetch peer details from Staff and Students (try both tables for each id)
  const [staffList, studentList] = await Promise.all([
    allIds.length
      ? Staff.findAll({
          where: { id: { [Op.in]: allIds } },
          attributes: ["id", "full_name", "email", "phone"],
        })
      : [],
    allIds.length
      ? Students.findAll({
          where: { id: { [Op.in]: allIds } },
          attributes: [
            "id",
            "fname",
            "mname",
            "lname",
            "email",
            "matric_number",
          ],
        })
      : [],
  ]);

  const staffMap = new Map(staffList.map((s) => [s.id, s]));
  const studentMap = new Map(studentList.map((s) => [s.id, s]));
  const userType = req.user?.userType;

  const resolveUserType = (id) => {
    if (staffMap.has(id)) return "staff";
    if (studentMap.has(id)) return "student";
    return null;
  };

  const buildPeer = (sid) => {
    if (staffMap.has(sid)) {
      const s = staffMap.get(sid);
      return {
        id: s.id,
        full_name: s.full_name,
        email: s.email,
        role: "staff",
      };
    }
    if (studentMap.has(sid)) {
      const s = studentMap.get(sid);
      const name = [s.fname, s.mname, s.lname].filter(Boolean).join(" ").trim();
      return {
        id: s.id,
        full_name: name,
        email: s.email,
        matric_number: s.matric_number,
        role: "student",
      };
    }
    return { id: sid, full_name: "Unknown", role: "unknown" };
  };

  const threads = grouped.map((g) => {
    const lm = g.lastMessage;
    const sid = g._id;
    const peer = buildPeer(sid);

    const senderType =
      lm.senderType ?? resolveUserType(lm.senderId) ?? (lm.senderId === userId ? userType : null);
    const receiverType =
      lm.receiverType ?? resolveUserType(lm.receiverId) ?? (lm.receiverId === userId ? userType : null);

    return {
      peer,
      lastMessage: {
        id: lm._id,
        sender_id: lm.senderId,
        sender_type: senderType ?? null,
        receiver_id: lm.receiverId,
        receiver_type: receiverType ?? null,
        message_text: lm.messageText,
        created_at: lm.created_at,
        delivered_at: lm.deliveredAt || null,
        read_at: lm.readAt || null,
      },
      unreadCount: g.unreadCount,
    };
  });

  const response = {
    threads,
    pagination: {
      current_page: page,
      per_page: limit,
      returned: threads.length,
    },
    filters: {
      search: search || null,
    },
  };

  // Cache the result for first page only
  if (page === 1 && !search) {
    await cacheChatList(userId, response);
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Recent threads fetched successfully",
    data: response,
  });
});
