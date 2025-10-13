import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { DirectMessage } from "../../models/chat/directMessage.js";
import { Staff } from "../../models/auth/staff.js";
import { Students } from "../../models/auth/student.js";
import { Op } from "sequelize";

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

  // Aggregate threads grouped by typed peer (type + id)
  const pipeline = [
    {
      $match: {
        $or: [{ senderId: userId }, { receiverId: userId }],
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
        _id: { peerId: "$peerId", peerType: "$peerType" },
        lastMessage: { $first: "$$ROOT" },
        unreadCount: { $sum: { $cond: ["$isUnreadForUser", 1, 0] } },
      },
    },
    { $sort: { "lastMessage.created_at": -1 } },
    { $skip: skip },
    { $limit: limit },
  ];

  const grouped = await DirectMessage.aggregate(pipeline).exec();
  const peerIds = grouped.map((g) => g._id.peerId);
  const peerTypes = grouped.map((g) => g._id.peerType);

  // Fetch peer details from Staff and Students
  const [staffList, studentList] = await Promise.all([
    peerIds.length
      ? Staff.findAll({
          where: { id: { [Op.in]: peerIds } },
          attributes: ["id", "full_name", "email", "phone"],
        })
      : [],
    peerIds.length
      ? Students.findAll({
          where: { id: { [Op.in]: peerIds } },
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

  const threads = grouped.map((g) => {
    const lm = g.lastMessage;
    const sid = g._id.peerId;
    const stype = g._id.peerType;
    let peer = null;
    if (stype === "staff" && staffMap.has(sid)) {
      const s = staffMap.get(sid);
      peer = {
        id: s.id,
        full_name: s.full_name,
        email: s.email,
        role: "staff",
      };
    } else if (stype === "student" && studentMap.has(sid)) {
      const s = studentMap.get(sid);
      const name = [s.fname, s.mname, s.lname].filter(Boolean).join(" ").trim();
      peer = {
        id: s.id,
        full_name: name,
        email: s.email,
        matric_number: s.matric_number,
        role: "student",
      };
    } else {
      peer = { id: sid, full_name: "Unknown", role: stype || "unknown" };
    }

    return {
      peer,
      lastMessage: {
        id: lm._id,
        sender_id: lm.senderId,
        sender_type: lm.senderType,
        receiver_id: lm.receiverId,
        receiver_type: lm.receiverType,
        message_text: lm.messageText,
        created_at: lm.created_at,
        delivered_at: lm.deliveredAt || null,
        read_at: lm.readAt || null,
      },
      unreadCount: g.unreadCount,
    };
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Recent threads fetched successfully",
    data: {
      threads,
      pagination: {
        current_page: page,
        per_page: limit,
        returned: threads.length,
      },
      filters: {
        search: search || null,
      },
    },
  });
});
