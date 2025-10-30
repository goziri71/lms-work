import crypto from "crypto";
import { VideoCall } from "../../models/video/videoCall.js";
import { VideoCallParticipant } from "../../models/video/videoCallParticipant.js";
import { streamVideoService } from "../../service/streamVideoService.js";
import { db } from "../../database/database.js";
import { Config } from "../../config/config.js";

/**
 * Create a new video call
 * POST /api/video/calls
 * Body: { title, courseId?, callType, record?, region?, startsAt? }
 * Auth: Staff only
 */
export async function createCall(req, res) {
  try {
    const userId = req.user?.id;
    const userType = req.user?.userType;

    if (!Config.streamApiKey || !Config.streamSecret) {
      return res.status(503).json({
        success: false,
        message:
          "Video calls are currently disabled. Please contact administrator.",
      });
    }

    if (userType !== "staff") {
      return res.status(403).json({
        success: false,
        message: "Only staff can create video calls",
      });
    }

    const {
      title,
      courseId,
      callType = "lecture",
      record = false,
      region = Config.streamDefaultRegion,
      startsAt,
    } = req.body;

    // Map our callType to Stream's call types
    const streamCallType = callType === "lecture" ? "default" : "default";

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    // Generate unique Stream call ID (only a-z, 0-9, _, - allowed)
    const callUuid = crypto.randomUUID();
    const streamCallId = `video_${callType}_${callUuid}`;

    // Create call record in Postgres
    const call = await VideoCall.create({
      created_by: userId,
      course_id: courseId || null,
      title,
      stream_call_id: streamCallId,
      call_type: callType,
      region,
      record,
      starts_at: startsAt || null,
    });

    // Initialize call in Stream
    await streamVideoService.getOrCreateCall(streamCallType, streamCallId, {
      createdBy: String(userId),
      record,
      startsAt,
    });

    // Add creator as host participant
    await VideoCallParticipant.create({
      call_id: call.id,
      user_id: userId,
      user_type: "staff",
      role: "host",
    });

    res.status(201).json({
      success: true,
      data: {
        id: call.id,
        title: call.title,
        streamCallId: call.stream_call_id,
        callType: call.call_type,
        record: call.record,
        region: call.region,
        startsAt: call.starts_at,
        createdAt: call.created_at,
      },
    });
  } catch (error) {
    console.error("Create call error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create call",
      error: error.message,
    });
  }
}

/**
 * Get call details
 * GET /api/video/calls/:id
 */
export async function getCall(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.userType;

    const call = await VideoCall.findByPk(id);

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found",
      });
    }

    // Access control: if course-linked, check enrollment/assignment
    if (call.course_id) {
      let allowed = false;
      if (userType === "staff") {
        const [rows] = await db.query(
          "SELECT 1 FROM courses WHERE id = ? AND staff_id = ?",
          { replacements: [call.course_id, userId] }
        );
        allowed = rows.length > 0;
      } else if (userType === "student") {
        const [rows] = await db.query(
          "SELECT 1 FROM course_reg WHERE course_id = ? AND student_id = ?",
          { replacements: [call.course_id, userId] }
        );
        allowed = rows.length > 0;
      }
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this call",
        });
      }
    }

    res.json({
      success: true,
      data: {
        id: call.id,
        title: call.title,
        streamCallId: call.stream_call_id,
        callType: call.call_type,
        record: call.record,
        region: call.region,
        startsAt: call.starts_at,
        endedAt: call.ended_at,
        recordingUrl: call.recording_url,
        createdAt: call.created_at,
      },
    });
  } catch (error) {
    console.error("Get call error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get call",
      error: error.message,
    });
  }
}

/**
 * Generate Stream video token for user to join call
 * POST /api/video/calls/:id/token
 * Body: { role? }
 */
export async function generateToken(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.userType;

    if (!Config.streamApiKey || !Config.streamSecret) {
      return res.status(503).json({
        success: false,
        message:
          "Video calls are currently disabled. Please contact administrator.",
      });
    }

    const call = await VideoCall.findByPk(id);

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found",
      });
    }

    // Access control
    if (call.course_id) {
      let allowed = false;
      if (userType === "staff") {
        const [rows] = await db.query(
          "SELECT 1 FROM courses WHERE id = ? AND staff_id = ?",
          { replacements: [call.course_id, userId] }
        );
        allowed = rows.length > 0;
      } else if (userType === "student") {
        const [rows] = await db.query(
          "SELECT 1 FROM course_reg WHERE course_id = ? AND student_id = ?",
          { replacements: [call.course_id, userId] }
        );
        allowed = rows.length > 0;
      }
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this call",
        });
      }
    }

    // Determine role
    let role = "participant";
    if (call.created_by === userId) {
      role = "host";
    } else if (userType === "staff") {
      role = "cohost";
    } else {
      role = req.body.role || "participant";
    }

    // Generate token (1 hour TTL)
    const token = streamVideoService.generateUserToken(userId, 3600);

    // Record participant
    const [participant] = await VideoCallParticipant.findOrCreate({
      where: {
        call_id: call.id,
        user_id: userId,
      },
      defaults: {
        call_id: call.id,
        user_id: userId,
        user_type: userType,
        role,
      },
    });

    res.json({
      success: true,
      data: {
        apiKey: Config.streamApiKey,
        token,
        streamCallId: call.stream_call_id,
        callType: call.call_type,
        userId: String(userId),
        role,
      },
    });
  } catch (error) {
    console.error("Generate token error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate token",
      error: error.message,
    });
  }
}

/**
 * List calls for a course
 * GET /api/video/calls?courseId=123
 */
export async function listCalls(req, res) {
  try {
    const { courseId } = req.query;
    const userId = req.user?.id;
    const userType = req.user?.userType;

    const where = {};
    if (courseId) {
      // Verify access
      if (userType === "staff") {
        const [rows] = await db.query(
          "SELECT 1 FROM courses WHERE id = ? AND staff_id = ?",
          { replacements: [courseId, userId] }
        );
        if (rows.length === 0) {
          return res.status(403).json({
            success: false,
            message: "You do not have access to this course",
          });
        }
      } else if (userType === "student") {
        const [rows] = await db.query(
          "SELECT 1 FROM course_reg WHERE course_id = ? AND student_id = ?",
          { replacements: [courseId, userId] }
        );
        if (rows.length === 0) {
          return res.status(403).json({
            success: false,
            message: "You are not enrolled in this course",
          });
        }
      }
      where.course_id = courseId;
    }

    const calls = await VideoCall.findAll({
      where,
      order: [["created_at", "DESC"]],
      limit: 50,
    });

    res.json({
      success: true,
      data: calls.map((call) => ({
        id: call.id,
        title: call.title,
        streamCallId: call.stream_call_id,
        callType: call.call_type,
        startsAt: call.starts_at,
        endedAt: call.ended_at,
        createdAt: call.created_at,
      })),
    });
  } catch (error) {
    console.error("List calls error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list calls",
      error: error.message,
    });
  }
}

/**
 * End a call
 * POST /api/video/calls/:id/end
 * Auth: Host only
 */
export async function endCall(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const call = await VideoCall.findByPk(id);

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found",
      });
    }

    if (call.created_by !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the host can end the call",
      });
    }

    // End call in Stream
    await streamVideoService.endCall(call.call_type, call.stream_call_id);

    // Update ended_at
    await call.update({ ended_at: new Date() });

    res.json({
      success: true,
      message: "Call ended successfully",
    });
  } catch (error) {
    console.error("End call error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to end call",
      error: error.message,
    });
  }
}

/**
 * Delete a call (permanently remove)
 * DELETE /api/video/calls/:id
 * Auth: Host only (creator of the call)
 */
export async function deleteCall(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const call = await VideoCall.findByPk(id);

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found",
      });
    }

    if (call.created_by !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the host can delete the call",
      });
    }

    // Delete participants first (foreign key constraint)
    await VideoCallParticipant.destroy({
      where: { call_id: call.id },
    });

    // Delete the call record
    await call.destroy();

    res.json({
      success: true,
      message: "Call deleted successfully",
    });
  } catch (error) {
    console.error("Delete call error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete call",
      error: error.message,
    });
  }
}
