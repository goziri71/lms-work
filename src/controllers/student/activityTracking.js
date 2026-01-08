import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { trackLearnerActivity } from "../../middlewares/learnerActivityTracker.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";

/**
 * Track single activity event from frontend
 * POST /api/student/activity/track
 */
export const trackActivity = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can track activities", 403);
  }

  const {
    activity_type,
    course_id,
    module_id,
    unit_id,
    duration_seconds,
    engagement_metrics,
    start_time,
    end_time,
  } = req.body;

  // Validation
  if (!activity_type) {
    throw new ErrorClass("activity_type is required", 400);
  }

  const validActivityTypes = [
    "login",
    "logout",
    "course_view",
    "module_view",
    "unit_view",
    "course_completed",
    "module_completed",
    "unit_completed",
    "quiz_attempt",
    "exam_attempt",
    "download",
    "video_play",
    "other",
  ];

  if (!validActivityTypes.includes(activity_type)) {
    throw new ErrorClass(`Invalid activity_type. Must be one of: ${validActivityTypes.join(", ")}`, 400);
  }

  // Validate course access if course_id provided
  if (course_id) {
    const course = await Courses.findByPk(course_id);
    if (!course) {
      throw new ErrorClass("Course not found", 404);
    }

    // Check if student has access to course
    const registration = await CourseReg.findOne({
      where: {
        student_id: studentId,
        course_id: course_id,
      },
    });

    if (!registration) {
      throw new ErrorClass("You do not have access to this course", 403);
    }
  }

  // Validate duration if provided
  if (duration_seconds !== undefined && duration_seconds !== null) {
    if (typeof duration_seconds !== "number" || duration_seconds < 0) {
      throw new ErrorClass("duration_seconds must be a non-negative number", 400);
    }
  }

  // Validate start_time and end_time if provided
  if (start_time && end_time) {
    const start = new Date(start_time);
    const end = new Date(end_time);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ErrorClass("start_time and end_time must be valid ISO timestamps", 400);
    }
    
    if (end <= start) {
      throw new ErrorClass("end_time must be after start_time", 400);
    }

    // Calculate duration from start/end if duration_seconds not provided
    if (!duration_seconds) {
      duration_seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    }
  }

  // Validate engagement metrics if provided
  if (engagement_metrics) {
    if (typeof engagement_metrics !== "object") {
      throw new ErrorClass("engagement_metrics must be an object", 400);
    }

    if (engagement_metrics.scroll_depth !== undefined) {
      const scrollDepth = parseFloat(engagement_metrics.scroll_depth);
      if (isNaN(scrollDepth) || scrollDepth < 0 || scrollDepth > 100) {
        throw new ErrorClass("engagement_metrics.scroll_depth must be a number between 0 and 100", 400);
      }
    }

    if (engagement_metrics.video_watch_percentage !== undefined) {
      const videoWatch = parseFloat(engagement_metrics.video_watch_percentage);
      if (isNaN(videoWatch) || videoWatch < 0 || videoWatch > 100) {
        throw new ErrorClass("engagement_metrics.video_watch_percentage must be a number between 0 and 100", 400);
      }
    }

    if (engagement_metrics.interaction_count !== undefined) {
      const interactionCount = parseInt(engagement_metrics.interaction_count);
      if (isNaN(interactionCount) || interactionCount < 0) {
        throw new ErrorClass("engagement_metrics.interaction_count must be a non-negative integer", 400);
      }
    }
  }

  // Prepare metadata
  const metadata = {
    ...(engagement_metrics && { engagement_metrics }),
    ...(start_time && { start_time }),
    ...(end_time && { end_time }),
  };

  // Track activity
  await trackLearnerActivity(
    {
      activityType: activity_type,
      studentId,
      courseId: course_id || null,
      moduleId: module_id || null,
      unitId: unit_id || null,
      durationSeconds: duration_seconds || null,
      startTime: start_time || null,
      endTime: end_time || null,
      engagementMetrics: engagement_metrics || null,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    },
    req
  );

  res.status(200).json({
    success: true,
    message: "Activity tracked successfully",
  });
});

/**
 * Send heartbeat/ping to track active session
 * POST /api/student/activity/heartbeat
 */
export const sendHeartbeat = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can send heartbeats", 403);
  }

  const { course_id, module_id, unit_id, is_active, timestamp } = req.body;

  // Validation
  if (course_id === undefined && module_id === undefined && unit_id === undefined) {
    throw new ErrorClass("At least one of course_id, module_id, or unit_id is required", 400);
  }

  // Validate course access if course_id provided
  if (course_id) {
    const course = await Courses.findByPk(course_id);
    if (!course) {
      throw new ErrorClass("Course not found", 404);
    }

    const registration = await CourseReg.findOne({
      where: {
        student_id: studentId,
        course_id: course_id,
      },
    });

    if (!registration) {
      throw new ErrorClass("You do not have access to this course", 403);
    }
  }

  // Track heartbeat as activity
  await trackLearnerActivity(
    {
      activityType: "other", // Heartbeat is tracked as "other" type
      studentId,
      courseId: course_id || null,
      moduleId: module_id || null,
      unitId: unit_id || null,
      metadata: {
        heartbeat: true,
        is_active: is_active !== false, // Default to true
        timestamp: timestamp || new Date().toISOString(),
      },
    },
    req
  );

  res.status(200).json({
    success: true,
    message: "Heartbeat received",
  });
});

/**
 * Track multiple activity events in batch
 * POST /api/student/activity/batch
 */
export const trackBatch = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can track activities", 403);
  }

  const { events } = req.body;

  if (!Array.isArray(events) || events.length === 0) {
    throw new ErrorClass("events must be a non-empty array", 400);
  }

  if (events.length > 50) {
    throw new ErrorClass("Maximum 50 events per batch", 400);
  }

  const validActivityTypes = [
    "login",
    "logout",
    "course_view",
    "module_view",
    "unit_view",
    "course_completed",
    "module_completed",
    "unit_completed",
    "quiz_attempt",
    "exam_attempt",
    "download",
    "video_play",
    "other",
  ];

  let processed = 0;
  const errors = [];

  // Process each event
  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    try {
      // Validate event
      if (!event.activity_type) {
        errors.push({ index: i, error: "activity_type is required" });
        continue;
      }

      if (!validActivityTypes.includes(event.activity_type)) {
        errors.push({ index: i, error: `Invalid activity_type: ${event.activity_type}` });
        continue;
      }

      // Validate course access if course_id provided
      if (event.course_id) {
        const course = await Courses.findByPk(event.course_id);
        if (!course) {
          errors.push({ index: i, error: "Course not found" });
          continue;
        }

        const registration = await CourseReg.findOne({
          where: {
            student_id: studentId,
            course_id: event.course_id,
          },
        });

        if (!registration) {
          errors.push({ index: i, error: "No access to course" });
          continue;
        }
      }

      // Prepare metadata
      const metadata = {
        ...(event.engagement_metrics && { engagement_metrics: event.engagement_metrics }),
        ...(event.start_time && { start_time: event.start_time }),
        ...(event.end_time && { end_time: event.end_time }),
        ...(event.metadata && typeof event.metadata === "object" ? event.metadata : {}),
      };

      // Calculate duration if start_time and end_time provided
      let durationSeconds = event.duration_seconds;
      if (!durationSeconds && event.start_time && event.end_time) {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
          durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
        }
      }

      // Track activity
      await trackLearnerActivity(
        {
          activityType: event.activity_type,
          studentId,
          courseId: event.course_id || null,
          moduleId: event.module_id || null,
          unitId: event.unit_id || null,
          durationSeconds: durationSeconds || null,
          startTime: event.start_time || null,
          endTime: event.end_time || null,
          engagementMetrics: event.engagement_metrics || null,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
        },
        req
      );

      processed++;
    } catch (error) {
      errors.push({ index: i, error: error.message });
    }
  }

  res.status(200).json({
    success: true,
    message: "Batch events processed",
    data: {
      total: events.length,
      processed,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
});
