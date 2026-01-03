import crypto from "crypto";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CoachingSession } from "../../models/marketplace/coachingSession.js";
import { CoachingParticipant } from "../../models/marketplace/coachingParticipant.js";
import { CoachingSettings } from "../../models/marketplace/coachingSettings.js";
import { Students } from "../../models/auth/student.js";
import { streamVideoService } from "../../service/streamVideoService.js";
import { Config } from "../../config/config.js";
import { emailService } from "../../services/emailService.js";
import { checkAndDeductHours, refundHours } from "./coachingHours.js";
import { db } from "../../database/database.js";
import { Op } from "sequelize";

/**
 * Helper to get tutor ID and type from request
 */
function getTutorInfo(req) {
  const userType = req.user.userType;
  let tutorId, tutorType, tutorName, tutorEmail;

  if (userType === "sole_tutor") {
    tutorId = req.tutor.id;
    tutorType = "sole_tutor";
    tutorName = `${req.tutor.fname} ${req.tutor.lname}`;
    tutorEmail = req.tutor.email;
  } else if (userType === "organization") {
    tutorId = req.tutor.id;
    tutorType = "organization";
    tutorName = req.tutor.name;
    tutorEmail = req.tutor.email;
  } else if (userType === "organization_user") {
    tutorId = req.tutor.organization_id;
    tutorType = "organization";
    tutorName = req.tutor.organization?.name || `${req.tutor.fname} ${req.tutor.lname}`;
    tutorEmail = req.tutor.email;
  } else {
    throw new ErrorClass("Invalid user type", 403);
  }

  return { tutorId, tutorType, tutorName, tutorEmail };
}

/**
 * Create a coaching session
 * POST /api/marketplace/tutor/coaching/sessions
 * Body: { title, description?, start_time, end_time, student_ids[] }
 */
export const createSession = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType, tutorName, tutorEmail } = getTutorInfo(req);
  const { title, description, start_time, end_time, student_ids } = req.body;

  if (!title || !start_time || !end_time) {
    throw new ErrorClass("Title, start_time, and end_time are required", 400);
  }

  const startTime = new Date(start_time);
  const endTime = new Date(end_time);

  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    throw new ErrorClass("Invalid date format for start_time or end_time", 400);
  }

  if (endTime <= startTime) {
    throw new ErrorClass("end_time must be after start_time", 400);
  }

  if (startTime < new Date()) {
    throw new ErrorClass("start_time cannot be in the past", 400);
  }

  // Calculate duration in minutes
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.round(durationMs / (1000 * 60));
  const durationHours = durationMinutes / 60;

  // Get coaching settings
  const settings = await CoachingSettings.findOne();
  if (!settings) {
    throw new ErrorClass("Coaching settings not configured", 500);
  }

  // Check and deduct hours (if not unlimited)
  const hoursCheck = await checkAndDeductHours(tutorId, tutorType, durationHours);
  if (!hoursCheck.allowed) {
    throw new ErrorClass(hoursCheck.reason, 400);
  }

  const transaction = await db.transaction();

  try {
    // Generate Stream.io call ID
    const callUuid = crypto.randomUUID();
    const streamCallId = `coaching_${tutorId}_${callUuid}`;

    // Create Stream.io call
    if (!Config.streamApiKey || !Config.streamSecret) {
      throw new ErrorClass("Video calls are currently disabled. Please contact administrator.", 503);
    }

    await streamVideoService.getOrCreateCall("default", streamCallId, {
      createdBy: String(tutorId),
      record: false,
      startsAt: startTime.toISOString(),
    });

    // Generate view link (public link for students)
    const viewLink = `${Config.frontendUrl}/coaching/session/${streamCallId}`;

    // Create session record
    const session = await CoachingSession.create(
      {
        tutor_id: tutorId,
        tutor_type: tutorType,
        title,
        description: description || null,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        stream_call_id: streamCallId,
        view_link: viewLink,
        status: "scheduled",
        hours_reserved: durationHours,
        hours_used: 0.0,
        student_count: student_ids?.length || 0,
      },
      { transaction }
    );

    // Add participants if provided
    if (student_ids && Array.isArray(student_ids) && student_ids.length > 0) {
      // Validate student IDs exist
      const students = await Students.findAll({
        where: {
          id: {
            [Op.in]: student_ids,
          },
        },
        transaction,
      });

      if (students.length !== student_ids.length) {
        throw new ErrorClass("Some student IDs are invalid", 400);
      }

      // Create participant records
      const participants = await Promise.all(
        students.map((student) =>
          CoachingParticipant.create(
            {
              session_id: session.id,
              student_id: student.id,
              email_sent: false,
            },
            { transaction }
          )
        )
      );

      // Send email invitations
      await sendSessionInvitations(session, students, tutorName, tutorEmail, viewLink, startTime, endTime);
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Coaching session created successfully",
      data: {
        id: session.id,
        title: session.title,
        start_time: session.start_time,
        end_time: session.end_time,
        duration_minutes: session.duration_minutes,
        stream_call_id: session.stream_call_id,
        view_link: session.view_link,
        status: session.status,
        hours_reserved: parseFloat(session.hours_reserved),
        student_count: session.student_count,
      },
    });
  } catch (error) {
    await transaction.rollback();
    // Refund hours if session creation failed
    if (hoursCheck.allowed && !hoursCheck.unlimited) {
      await refundHours(tutorId, tutorType, durationHours);
    }
    throw error;
  }
});

/**
 * Send email invitations to students
 */
async function sendSessionInvitations(session, students, tutorName, tutorEmail, viewLink, startTime, endTime) {
  const startTimeStr = new Date(startTime).toLocaleString();
  const endTimeStr = new Date(endTime).toLocaleString();

  for (const student of students) {
    try {
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Coaching Session Invitation</h2>
          <p>Hello ${student.name || student.email},</p>
          <p>You have been invited to a coaching session by <strong>${tutorName}</strong>.</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Session Details</h3>
            <p><strong>Title:</strong> ${session.title}</p>
            ${session.description ? `<p><strong>Description:</strong> ${session.description}</p>` : ""}
            <p><strong>Start Time:</strong> ${startTimeStr}</p>
            <p><strong>End Time:</strong> ${endTimeStr}</p>
            <p><strong>Tutor:</strong> ${tutorName}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${viewLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Join Session
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">This is an automated invitation. Please do not reply to this email.</p>
        </div>
      `;

      await emailService.sendEmail({
        to: student.email,
        name: student.name || student.email,
        subject: `Coaching Session Invitation: ${session.title}`,
        htmlBody,
      });

      // Update participant email_sent flag
      await CoachingParticipant.update(
        { email_sent: true },
        {
          where: {
            session_id: session.id,
            student_id: student.id,
          },
        }
      );
    } catch (error) {
      console.error(`Failed to send invitation email to ${student.email}:`, error);
      // Continue with other students even if one fails
    }
  }
}

/**
 * List coaching sessions
 * GET /api/marketplace/tutor/coaching/sessions
 */
export const listSessions = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { status, page = 1, limit = 20 } = req.query;

  const where = {
    tutor_id: tutorId,
    tutor_type: tutorType,
  };

  if (status) {
    where.status = status;
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: sessions } = await CoachingSession.findAndCountAll({
    where,
    include: [
      {
        model: CoachingParticipant,
        as: "participants",
        include: [
          {
            model: Students,
            as: "student",
            attributes: ["id", "name", "email"],
          },
        ],
      },
    ],
    order: [["start_time", "DESC"]],
    limit: parseInt(limit),
    offset,
  });

  res.json({
    success: true,
    data: {
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        start_time: s.start_time,
        end_time: s.end_time,
        duration_minutes: s.duration_minutes,
        view_link: s.view_link,
        status: s.status,
        hours_reserved: parseFloat(s.hours_reserved),
        hours_used: parseFloat(s.hours_used),
        student_count: s.student_count,
        actual_start_time: s.actual_start_time,
        actual_end_time: s.actual_end_time,
        participants: s.participants?.map((p) => ({
          id: p.id,
          student: p.student ? { id: p.student.id, name: p.student.name, email: p.student.email } : null,
          invited_at: p.invited_at,
          joined_at: p.joined_at,
          left_at: p.left_at,
        })),
        created_at: s.created_at,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

/**
 * Get session details
 * GET /api/marketplace/tutor/coaching/sessions/:id
 */
export const getSession = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const session = await CoachingSession.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
    include: [
      {
        model: CoachingParticipant,
        as: "participants",
        include: [
          {
            model: Students,
            as: "student",
            attributes: ["id", "name", "email"],
          },
        ],
      },
    ],
  });

  if (!session) {
    throw new ErrorClass("Session not found", 404);
  }

  res.json({
    success: true,
    data: {
      id: session.id,
      title: session.title,
      description: session.description,
      start_time: session.start_time,
      end_time: session.end_time,
      duration_minutes: session.duration_minutes,
      stream_call_id: session.stream_call_id,
      view_link: session.view_link,
      status: session.status,
      hours_reserved: parseFloat(session.hours_reserved),
      hours_used: parseFloat(session.hours_used),
      student_count: session.student_count,
      actual_start_time: session.actual_start_time,
      actual_end_time: session.actual_end_time,
      participants: session.participants?.map((p) => ({
        id: p.id,
        student: p.student ? { id: p.student.id, name: p.student.name, email: p.student.email } : null,
        invited_at: p.invited_at,
        joined_at: p.joined_at,
        left_at: p.left_at,
      })),
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
  });
});

/**
 * Invite students to existing session
 * POST /api/marketplace/tutor/coaching/sessions/:id/invite
 * Body: { student_ids[] }
 */
export const inviteStudents = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType, tutorName, tutorEmail } = getTutorInfo(req);
  const { id } = req.params;
  const { student_ids } = req.body;

  if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
    throw new ErrorClass("student_ids array is required", 400);
  }

  const session = await CoachingSession.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!session) {
    throw new ErrorClass("Session not found", 404);
  }

  if (session.status === "ended" || session.status === "cancelled") {
    throw new ErrorClass("Cannot invite students to a completed or cancelled session", 400);
  }

  // Validate student IDs
  const students = await Students.findAll({
    where: {
      id: {
        [Op.in]: student_ids,
      },
    },
  });

  if (students.length !== student_ids.length) {
    throw new ErrorClass("Some student IDs are invalid", 400);
  }

  // Check for existing participants
  const existingParticipants = await CoachingParticipant.findAll({
    where: {
      session_id: id,
      student_id: {
        [Op.in]: student_ids,
      },
    },
  });

  const existingStudentIds = existingParticipants.map((p) => p.student_id);
  const newStudentIds = student_ids.filter((id) => !existingStudentIds.includes(id));

  if (newStudentIds.length === 0) {
    throw new ErrorClass("All students are already invited", 400);
  }

  const newStudents = students.filter((s) => newStudentIds.includes(s.id));

  // Create participant records
  const participants = await Promise.all(
    newStudents.map((student) =>
      CoachingParticipant.create({
        session_id: id,
        student_id: student.id,
        email_sent: false,
      })
    )
  );

  // Update student count
  await session.update({
    student_count: session.student_count + newStudents.length,
  });

  // Send email invitations
  await sendSessionInvitations(
    session,
    newStudents,
    tutorName,
    tutorEmail,
    session.view_link,
    session.start_time,
    session.end_time
  );

  res.json({
    success: true,
    message: "Students invited successfully",
    data: {
      invited_count: newStudents.length,
      participants: participants.map((p) => ({
        id: p.id,
        student_id: p.student_id,
      })),
    },
  });
});

/**
 * Start a coaching session
 * POST /api/marketplace/tutor/coaching/sessions/:id/start
 */
export const startSession = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const session = await CoachingSession.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!session) {
    throw new ErrorClass("Session not found", 404);
  }

  if (session.status !== "scheduled") {
    throw new ErrorClass(`Cannot start session with status: ${session.status}`, 400);
  }

  const now = new Date();
  if (now < new Date(session.start_time)) {
    throw new ErrorClass("Session start time has not been reached", 400);
  }

  // Update session status
  await session.update({
    status: "active",
    actual_start_time: now,
  });

  res.json({
    success: true,
    message: "Session started successfully",
    data: {
      id: session.id,
      status: "active",
      actual_start_time: session.actual_start_time,
      stream_call_id: session.stream_call_id,
      view_link: session.view_link,
    },
  });
});

/**
 * End a coaching session
 * POST /api/marketplace/tutor/coaching/sessions/:id/end
 */
export const endSession = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const session = await CoachingSession.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!session) {
    throw new ErrorClass("Session not found", 404);
  }

  if (session.status !== "active") {
    throw new ErrorClass(`Cannot end session with status: ${session.status}`, 400);
  }

  const now = new Date();
  const actualStartTime = session.actual_start_time || session.start_time;
  const actualDurationMs = now.getTime() - new Date(actualStartTime).getTime();
  const actualDurationHours = actualDurationMs / (1000 * 60 * 60);

  // End Stream.io call
  if (session.stream_call_id) {
    try {
      await streamVideoService.endCall("default", session.stream_call_id);
    } catch (error) {
      console.error("Failed to end Stream.io call:", error);
      // Continue even if Stream.io call fails
    }
  }

  // Update session
  await session.update({
    status: "ended",
    actual_end_time: now,
    hours_used: actualDurationHours,
  });

  // Adjust hours balance if actual duration is less than reserved
  const reservedHours = parseFloat(session.hours_reserved);
  if (actualDurationHours < reservedHours) {
    // Refund the difference
    const refundHours = reservedHours - actualDurationHours;
    await refundHours(tutorId, tutorType, refundHours);
  }

  res.json({
    success: true,
    message: "Session ended successfully",
    data: {
      id: session.id,
      status: "ended",
      actual_start_time: session.actual_start_time,
      actual_end_time: now,
      hours_reserved: parseFloat(session.hours_reserved),
      hours_used: actualDurationHours,
    },
  });
});

/**
 * Get join token for session
 * POST /api/marketplace/tutor/coaching/sessions/:id/token
 */
export const getJoinToken = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const session = await CoachingSession.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!session) {
    throw new ErrorClass("Session not found", 404);
  }

  if (!session.stream_call_id) {
    throw new ErrorClass("Stream call ID not found", 500);
  }

  if (!Config.streamApiKey || !Config.streamSecret) {
    throw new ErrorClass("Video calls are currently disabled", 503);
  }

  // Generate token (1 hour TTL)
  const token = streamVideoService.generateUserToken(tutorId, 3600);

  res.json({
    success: true,
    data: {
      apiKey: Config.streamApiKey,
      token,
      streamCallId: session.stream_call_id,
      userId: String(tutorId),
      role: "host",
    },
  });
});

/**
 * Cancel a coaching session
 * DELETE /api/marketplace/tutor/coaching/sessions/:id
 */
export const cancelSession = TryCatchFunction(async (req, res) => {
  const { tutorId, tutorType } = getTutorInfo(req);
  const { id } = req.params;

  const session = await CoachingSession.findOne({
    where: {
      id,
      tutor_id: tutorId,
      tutor_type: tutorType,
    },
  });

  if (!session) {
    throw new ErrorClass("Session not found", 404);
  }

  if (session.status === "ended") {
    throw new ErrorClass("Cannot cancel an ended session", 400);
  }

  if (session.status === "cancelled") {
    throw new ErrorClass("Session is already cancelled", 400);
  }

  // Refund reserved hours
  if (session.hours_reserved > 0) {
    await refundHours(tutorId, tutorType, parseFloat(session.hours_reserved));
  }

  // End Stream.io call if active
  if (session.stream_call_id && session.status === "active") {
    try {
      await streamVideoService.endCall("default", session.stream_call_id);
    } catch (error) {
      console.error("Failed to end Stream.io call:", error);
    }
  }

  // Update session status
  await session.update({
    status: "cancelled",
  });

  res.json({
    success: true,
    message: "Session cancelled successfully",
    data: {
      id: session.id,
      status: "cancelled",
    },
  });
});

