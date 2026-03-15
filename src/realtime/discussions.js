import { AuthService } from "../service/authservice.js";
import { Config } from "../config/config.js";
import { db } from "../database/database.js";
import { Discussions } from "../models/modules/discussions.js";
import { DiscussionMessage } from "../models/chat/discussionMessage.js";
import { Staff } from "../models/auth/staff.js";
import { Students } from "../models/auth/student.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";
import { OrganizationUser } from "../models/marketplace/organizationUser.js";
import { Op } from "sequelize";
import mongoose from "mongoose";

const authService = new AuthService();

// Cache course metadata to avoid repeated DB lookups
const courseMetaCache = new Map();
const COURSE_META_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCourseMeta(courseId) {
  const id = Number(courseId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const cached = courseMetaCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const [rows] = await db.query(
    "SELECT id, is_marketplace, owner_type, owner_id, staff_id FROM courses WHERE id = ? LIMIT 1",
    { replacements: [id] },
  );

  const data = rows?.[0] || null;
  courseMetaCache.set(id, { data, expiresAt: Date.now() + COURSE_META_TTL_MS });
  return data;
}

function normalizeScope(courseMeta, academicYear, semester) {
  // Marketplace course purchases are lifetime and not tied to academic year/semester.
  // Use a stable scope so all buyers/tutors join the same room.
  if (courseMeta?.is_marketplace) {
    return { academicYear: "marketplace", semester: "lifetime" };
  }
  return { academicYear, semester };
}

function isStaffLikeRole(role) {
  return (
    role === "staff" ||
    role === "sole_tutor" ||
    role === "organization" ||
    role === "organization_user"
  );
}

function toStoredSenderType(role) {
  return isStaffLikeRole(role) ? "staff" : "student";
}

function parseSocketActor(socketUser) {
  const tokenId = socketUser?.id;
  const normalizedId =
    typeof tokenId === "object"
      ? tokenId?.id ??
        tokenId?.user_id ??
        tokenId?.student_id ??
        tokenId?.staff_id ??
        tokenId?.organization_user_id ??
        tokenId?.organization_id
      : tokenId;
  const userId = Number(normalizedId);

  const organizationIdRaw =
    socketUser?.organizationId ??
    socketUser?.organization_id ??
    (typeof tokenId === "object" ? tokenId?.organization_id : null);
  const organizationId = Number(organizationIdRaw);

  return {
    userId,
    userType: socketUser?.userType,
    organizationId: Number.isInteger(organizationId) && organizationId > 0 ? organizationId : null,
  };
}

function studentName(student) {
  return [student?.fname, student?.mname, student?.lname]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function personName(person) {
  return [person?.fname, person?.mname, person?.lname]
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function getIdentityMaps(ids) {
  const userIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!userIds.length) {
    return {
      staffMap: new Map(),
      studentMap: new Map(),
      tutorMap: new Map(),
      organizationMap: new Map(),
      organizationUserMap: new Map(),
    };
  }

  const [staffRows, studentRows, tutorRows, organizationRows, orgUserRows] = await Promise.all([
    Staff.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id", "full_name"] }),
    Students.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id", "fname", "mname", "lname"] }),
    SoleTutor.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id", "fname", "mname", "lname"] }),
    Organization.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id", "name"] }),
    OrganizationUser.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id", "fname", "mname", "lname"] }),
  ]);

  return {
    staffMap: new Map(staffRows.map((r) => [Number(r.id), r])),
    studentMap: new Map(studentRows.map((r) => [Number(r.id), r])),
    tutorMap: new Map(tutorRows.map((r) => [Number(r.id), r])),
    organizationMap: new Map(organizationRows.map((r) => [Number(r.id), r])),
    organizationUserMap: new Map(orgUserRows.map((r) => [Number(r.id), r])),
  };
}

function resolveSenderIdentity({ senderId, senderType, courseMeta, maps }) {
  let senderRole = senderType === "staff" ? "staff" : "student";

  if (courseMeta?.staff_id && Number(courseMeta.staff_id) === Number(senderId)) {
    senderRole = "staff";
  } else if (
    courseMeta?.owner_id &&
    Number(courseMeta.owner_id) === Number(senderId) &&
    courseMeta?.owner_type === "sole_tutor"
  ) {
    senderRole = "sole_tutor";
  } else if (
    courseMeta?.owner_id &&
    Number(courseMeta.owner_id) === Number(senderId) &&
    courseMeta?.owner_type === "organization"
  ) {
    senderRole = "organization";
  } else if (maps.organizationUserMap.has(Number(senderId))) {
    senderRole = "organization_user";
  } else if (maps.tutorMap.has(Number(senderId))) {
    senderRole = "sole_tutor";
  } else if (maps.organizationMap.has(Number(senderId))) {
    senderRole = "organization";
  } else if (maps.staffMap.has(Number(senderId))) {
    senderRole = "staff";
  } else if (maps.studentMap.has(Number(senderId))) {
    senderRole = "student";
  }

  let senderName = null;
  if (senderRole === "staff") {
    senderName = maps.staffMap.get(Number(senderId))?.full_name || null;
  } else if (senderRole === "student") {
    senderName = studentName(maps.studentMap.get(Number(senderId))) || null;
  } else if (senderRole === "sole_tutor") {
    senderName = personName(maps.tutorMap.get(Number(senderId))) || null;
  } else if (senderRole === "organization") {
    senderName = maps.organizationMap.get(Number(senderId))?.name || null;
  } else if (senderRole === "organization_user") {
    senderName = personName(maps.organizationUserMap.get(Number(senderId))) || null;
  }

  return {
    sender_type: toStoredSenderType(senderRole),
    sender_role: senderRole,
    sender_name: senderName || "Unknown",
  };
}

async function canAccessDiscussion({
  courseMeta,
  userType,
  userId,
  organizationId,
  courseId,
  academicYear,
  semester,
}) {
  // Staff access: instructor of the course
  if (userType === "staff") {
    const [rows] = await db.query(
      "SELECT 1 FROM courses WHERE id = ? AND staff_id = ?",
      { replacements: [courseId, userId] },
    );
    return rows.length > 0;
  }

  // Tutor access: owner of the marketplace course
  if (userType === "sole_tutor" || userType === "organization") {
    // Only allow tutors to access discussions for courses they own
    const [rows] = await db.query(
      "SELECT 1 FROM courses WHERE id = ? AND owner_type = ? AND owner_id = ?",
      { replacements: [courseId, userType, userId] },
    );
    return rows.length > 0;
  }
  if (userType === "organization_user") {
    const orgId = Number(organizationId || userId);
    if (!Number.isInteger(orgId) || orgId <= 0) return false;
    const [rows] = await db.query(
      "SELECT 1 FROM courses WHERE id = ? AND owner_type = 'organization' AND owner_id = ?",
      { replacements: [courseId, orgId] },
    );
    return rows.length > 0;
  }

  // Student access
  if (userType === "student") {
    if (courseMeta?.is_marketplace) {
      // Marketplace purchase enrollment: academic_year/semester are NULL
      const [rows] = await db.query(
        "SELECT 1 FROM course_reg WHERE course_id = ? AND student_id = ? AND registration_status = 'marketplace_purchased' LIMIT 1",
        { replacements: [courseId, userId] },
      );
      return rows.length > 0;
    }

    // School enrollment: requires academic year + semester match
    const [rows] = await db.query(
      "SELECT 1 FROM course_reg WHERE course_id = ? AND student_id = ? AND academic_year = ? AND semester = ?",
      { replacements: [courseId, userId, academicYear, semester] },
    );
    return rows.length > 0;
  }

  return false;
}

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
          const actor = parseSocketActor(socket.user);
          const userId = actor.userId;
          const userType = actor.userType;
          if (!Number.isInteger(userId) || userId <= 0)
            throw new Error("Unauthorized");

          const courseMeta = await getCourseMeta(courseId);
          const normalized = normalizeScope(courseMeta, academicYear, semester);

          // Access control
          const allowed = await canAccessDiscussion({
            courseMeta,
            userType,
            userId,
            organizationId: actor.organizationId,
            courseId,
            academicYear: normalized.academicYear,
            semester: normalized.semester,
          });
          if (!allowed) throw new Error("Forbidden");

          // Ensure discussion exists - use actual staff ID when creating
          const [discussion] = await Discussions.findOrCreate({
            where: {
              course_id: courseId,
              academic_year: normalized.academicYear,
              semester: normalized.semester,
            },
            defaults: {
              course_id: courseId,
              academic_year: normalized.academicYear,
              semester: normalized.semester,
              created_by_staff_id: userType === "staff" ? userId : 1, // Use actual staff ID or default to 1
            },
          });

          const room = roomName(
            courseId,
            normalized.academicYear,
            normalized.semester,
          );
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
              "MongoDB not connected. Check MONGO_URI and restart server.",
            );
          }

          // Load recent history from MongoDB
          const mongoMessages = await DiscussionMessage.find({
            courseId,
            academicYear: normalized.academicYear,
            semester: normalized.semester,
          })
            .sort({ created_at: 1 })
            .limit(100)
            .maxTimeMS(2000)
            .lean();

          const maps = await getIdentityMaps(mongoMessages.map((m) => m.senderId));
          const messages = mongoMessages.map((m) => {
            const identity = resolveSenderIdentity({
              senderId: m.senderId,
              senderType: m.senderType,
              courseMeta,
              maps,
            });
            return {
              id: m._id,
              discussion_id: discussion.id,
              sender_type: identity.sender_type,
              sender_role: identity.sender_role,
              sender_id: m.senderId,
              sender_name: identity.sender_name,
              message_text: m.messageText,
              created_at: m.created_at,
            };
          });

          cb?.({ ok: true, discussionId: discussion.id, messages });
        } catch (err) {
          cb?.({ ok: false, error: err.message });
        }
      },
    );

    socket.on(
      "postMessage",
      async ({ courseId, academicYear, semester, message_text }, cb) => {
        try {
          const actor = parseSocketActor(socket.user);
          const userId = actor.userId;
          const userType = actor.userType;
          const sender_type = toStoredSenderType(userType);

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

          const courseMeta = await getCourseMeta(courseId);
          const normalized = normalizeScope(courseMeta, academicYear, semester);

          // Re-verify access for security
          const allowed = await canAccessDiscussion({
            courseMeta,
            userType,
            userId,
            organizationId: actor.organizationId,
            courseId,
            academicYear: normalized.academicYear,
            semester: normalized.semester,
          });
          if (!allowed) throw new Error("Forbidden");

          const discussion = await Discussions.findOne({
            where: {
              course_id: courseId,
              academic_year: normalized.academicYear,
              semester: normalized.semester,
            },
          });
          if (!discussion) throw new Error("Discussion not found");

          // Check MongoDB connection
          if (mongoose.connection.readyState !== 1) {
            throw new Error(
              "MongoDB not connected. Check MONGO_URI and restart server.",
            );
          }

          // Persist message to MongoDB
          const created = await DiscussionMessage.create({
            courseId,
            academicYear: normalized.academicYear,
            semester: normalized.semester,
            senderType: sender_type,
            senderId: userId,
            messageText: message_text,
          });

          const maps = await getIdentityMaps([userId]);
          const identity = resolveSenderIdentity({
            senderId: userId,
            senderType: sender_type,
            courseMeta,
            maps,
          });

          const payload = {
            id: created._id,
            discussion_id: discussion.id,
            sender_type: identity.sender_type,
            sender_role: identity.sender_role,
            sender_id: userId,
            sender_name: identity.sender_name,
            message_text: message_text,
            created_at: created.created_at,
          };

          const room = roomName(
            courseId,
            normalized.academicYear,
            normalized.semester,
          );
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
      },
    );

    socket.on(
      "loadMoreMessages",
      async (
        { courseId, academicYear, semester, beforeMessageId, limit = 50 },
        cb,
      ) => {
        try {
          const actor = parseSocketActor(socket.user);
          const userId = actor.userId;
          const userType = actor.userType;
          if (!Number.isInteger(userId) || userId <= 0)
            throw new Error("Unauthorized");

          const courseMeta = await getCourseMeta(courseId);
          const normalized = normalizeScope(courseMeta, academicYear, semester);

          // Access control
          const allowed = await canAccessDiscussion({
            courseMeta,
            userType,
            userId,
            organizationId: actor.organizationId,
            courseId,
            academicYear: normalized.academicYear,
            semester: normalized.semester,
          });
          if (!allowed) throw new Error("Forbidden");

          // Find the discussion
          const discussion = await Discussions.findOne({
            where: {
              course_id: courseId,
              academic_year: normalized.academicYear,
              semester: normalized.semester,
            },
          });
          if (!discussion) throw new Error("Discussion not found");

          // Check MongoDB connection
          if (mongoose.connection.readyState !== 1) {
            throw new Error(
              "MongoDB not connected. Check MONGO_URI and restart server.",
            );
          }

          // Pagination via MongoDB
          const query = {
            courseId,
            academicYear: normalized.academicYear,
            semester: normalized.semester,
          };
          if (beforeMessageId) {
            query._id = { $lt: beforeMessageId };
          }

          const mongoMessages = await DiscussionMessage.find(query)
            .sort({ created_at: 1 })
            .limit(Math.min(limit, 100))
            .maxTimeMS(2000)
            .lean();

          const maps = await getIdentityMaps(mongoMessages.map((m) => m.senderId));
          const messages = mongoMessages.map((m) => {
            const identity = resolveSenderIdentity({
              senderId: m.senderId,
              senderType: m.senderType,
              courseMeta,
              maps,
            });
            return {
              id: m._id,
              discussion_id: discussion.id,
              sender_type: identity.sender_type,
              sender_role: identity.sender_role,
              sender_id: m.senderId,
              sender_name: identity.sender_name,
              message_text: m.messageText,
              created_at: m.created_at,
            };
          });

          cb?.({ ok: true, messages, hasMore: mongoMessages.length === limit });
        } catch (err) {
          cb?.({ ok: false, error: err.message });
        }
      },
    );
  });
}
