/**
 * Learner Activity Tracking Middleware
 * Automatically tracks learner activities (page views, course access, etc.)
 */

import { LearnerActivityLog } from "../models/marketplace/learnerActivityLog.js";
import { CourseProgress } from "../models/marketplace/courseProgress.js";
import { Courses } from "../models/course/courses.js";
import { getIPGeolocation, parseUserAgent } from "../services/ipGeolocationService.js";
import { db } from "../database/database.js";

/**
 * Track learner activity
 * @param {Object} options - Activity tracking options
 * @param {string} options.activityType - Type of activity
 * @param {number} options.studentId - Student ID
 * @param {number} [options.courseId] - Course ID (if applicable)
 * @param {number} [options.moduleId] - Module ID (if applicable)
 * @param {number} [options.unitId] - Unit ID (if applicable)
 * @param {number} [options.durationSeconds] - Duration in seconds
 * @param {string} [options.startTime] - Start time (ISO timestamp) - from frontend
 * @param {string} [options.endTime] - End time (ISO timestamp) - from frontend
 * @param {Object} [options.engagementMetrics] - Engagement metrics from frontend
 * @param {Object} [options.metadata] - Additional metadata
 * @param {Object} req - Express request object (for IP, user agent, etc.)
 */
export async function trackLearnerActivity(options, req = null) {
  const {
    activityType,
    studentId,
    courseId = null,
    moduleId = null,
    unitId = null,
    durationSeconds = null,
    startTime = null,
    endTime = null,
    engagementMetrics = null,
    metadata = null,
  } = options;

  if (!studentId || !activityType) {
    return;
  }

  try {
    // Get IP and user agent from request if available
    let ipAddress = null;
    let userAgent = null;
    let geoData = {};
    let deviceInfo = {};

    if (req) {
      ipAddress =
        req.ip ||
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.connection?.remoteAddress ||
        null;

      userAgent = req.headers["user-agent"] || null;

      // Get geolocation (with timeout)
      if (ipAddress && ipAddress !== "::1" && ipAddress !== "127.0.0.1" && !ipAddress.startsWith("192.168.") && !ipAddress.startsWith("10.") && !ipAddress.startsWith("172.")) {
        try {
          // Use Promise.race to timeout after 2 seconds
          const geoPromise = getIPGeolocation(ipAddress);
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ success: false }), 2000));
          geoData = await Promise.race([geoPromise, timeoutPromise]);
        } catch (err) {
          console.error("Geolocation error:", err.message);
          geoData = {};
        }
      }

      // Parse user agent
      if (userAgent) {
        deviceInfo = parseUserAgent(userAgent);
      }
    }

    // Get course info to determine tutor
    let tutorId = null;
    let tutorType = null;

    if (courseId) {
      try {
        const course = await Courses.findByPk(courseId, {
          attributes: ["owner_id", "owner_type"],
        });
        if (course) {
          tutorId = course.owner_id;
          tutorType = course.owner_type || "wpu";
        }
      } catch (error) {
        console.error("Error fetching course for activity log:", error.message);
      }
    }

    // Prepare metadata with engagement metrics and timing info
    const finalMetadata = {
      ...(metadata && typeof metadata === "object" ? metadata : {}),
      ...(startTime && { start_time: startTime }),
      ...(endTime && { end_time: endTime }),
      ...(engagementMetrics && {
        engagement_metrics: {
          scroll_depth: engagementMetrics.scroll_depth,
          video_watch_percentage: engagementMetrics.video_watch_percentage,
          interaction_count: engagementMetrics.interaction_count,
          engagement_score: engagementMetrics.engagement_score,
        },
      }),
    };

    // Create activity log entry
    await LearnerActivityLog.create({
      student_id: studentId,
      activity_type: activityType,
      course_id: courseId,
      module_id: moduleId,
      unit_id: unitId,
      tutor_id: tutorId,
      tutor_type: tutorType,
      ip_address: ipAddress,
      location_country: geoData.country || null,
      location_city: geoData.city || null,
      device_type: deviceInfo.device_type || null,
      browser: deviceInfo.browser || null,
      user_agent: userAgent,
      duration_seconds: durationSeconds,
      metadata: Object.keys(finalMetadata).length > 0 ? finalMetadata : null,
    });

    // Update course progress if course-related activity
    if (courseId && (activityType === "course_view" || activityType === "module_view" || activityType === "unit_view")) {
      await updateCourseProgress(
        studentId,
        courseId,
        tutorId,
        tutorType,
        activityType,
        moduleId,
        unitId,
        durationSeconds,
        engagementMetrics
      );
    }
  } catch (error) {
    console.error("Error tracking learner activity:", error.message);
    // Don't throw - activity tracking should not break the main request
  }
}

/**
 * Update course progress
 */
async function updateCourseProgress(
  studentId,
  courseId,
  tutorId,
  tutorType,
  activityType,
  moduleId,
  unitId,
  durationSeconds,
  engagementMetrics = null
) {
  try {
    // Get or create progress record
    let progress = await CourseProgress.findOne({
      where: {
        student_id: studentId,
        course_id: courseId,
      },
    });

    if (!progress) {
      // Get total modules count
      const { Modules } = await import("../models/modules/modules.js");
      const moduleCount = await Modules.count({
        where: { course_id: courseId },
      });

      progress = await CourseProgress.create({
        student_id: studentId,
        course_id: courseId,
        tutor_id: tutorId,
        tutor_type: tutorType,
        total_modules: moduleCount,
        completed_modules: 0,
        total_units: 0, // Will be updated when units are viewed
        viewed_units: 0,
        completion_percentage: 0.0,
        is_completed: false,
        started_at: new Date(),
        last_accessed_at: new Date(),
        total_time_spent_seconds: 0,
      });
    }

    // Update last accessed
    progress.last_accessed_at = new Date();

    // Update time spent
    if (durationSeconds) {
      progress.total_time_spent_seconds =
        (progress.total_time_spent_seconds || 0) + durationSeconds;
    }

    // Update engagement metrics in metadata if provided
    if (engagementMetrics) {
      const currentMetadata = progress.metadata && typeof progress.metadata === "object" ? progress.metadata : {};
      
      // Calculate or update engagement score
      let engagementScore = null;
      if (engagementMetrics.scroll_depth !== undefined || 
          engagementMetrics.video_watch_percentage !== undefined || 
          engagementMetrics.interaction_count !== undefined) {
        const scrollDepth = engagementMetrics.scroll_depth || 0;
        const videoWatch = engagementMetrics.video_watch_percentage || 0;
        const interactionScore = Math.min((engagementMetrics.interaction_count || 0) * 10, 100);
        engagementScore = (scrollDepth + videoWatch + interactionScore) / 3;
      }

      // Update metadata with engagement metrics
      const updatedMetadata = {
        ...currentMetadata,
        ...(engagementMetrics.scroll_depth !== undefined && {
          average_scroll_depth: engagementMetrics.scroll_depth,
        }),
        ...(engagementMetrics.video_watch_percentage !== undefined && {
          average_video_completion: engagementMetrics.video_watch_percentage,
        }),
        ...(engagementMetrics.interaction_count !== undefined && {
          total_interactions: (currentMetadata.total_interactions || 0) + engagementMetrics.interaction_count,
        }),
        ...(engagementScore !== null && {
          engagement_score: engagementScore,
        }),
      };

      progress.metadata = updatedMetadata;
    }

    // Update viewed units count if unit viewed
    if (activityType === "unit_view" && unitId) {
      // Check if this unit was already counted
      const existingLog = await LearnerActivityLog.findOne({
        where: {
          student_id: studentId,
          course_id: courseId,
          unit_id: unitId,
          activity_type: "unit_view",
        },
        order: [["created_at", "ASC"]],
      });

      // Only increment if this is the first time viewing this unit
      if (!existingLog || existingLog.id === (await LearnerActivityLog.findOne({
        where: {
          student_id: studentId,
          course_id: courseId,
          unit_id: unitId,
          activity_type: "unit_view",
        },
        order: [["created_at", "DESC"]],
      }))?.id) {
        // This is a new unit view
        const { Modules } = await import("../models/modules/modules.js");
        const { Units } = await import("../models/modules/units.js");
        
        // Get total units count for this course
        const modules = await Modules.findAll({
          where: { course_id: courseId },
          attributes: ["id"],
        });
        const moduleIds = modules.map((m) => m.id);
        const totalUnits = await Units.count({
          where: { module_id: { [db.Sequelize.Op.in]: moduleIds } },
        });
        
        progress.total_units = totalUnits;
        
        // Count unique viewed units
        const viewedUnits = await LearnerActivityLog.findAll({
          where: {
            student_id: studentId,
            course_id: courseId,
            activity_type: "unit_view",
          },
          attributes: ["unit_id"],
          group: ["unit_id"],
          raw: true,
        });
        
        progress.viewed_units = viewedUnits.length;
      }
    }

    // Check module completion (all units in module viewed)
    if (activityType === "unit_view" && moduleId) {
      const { Units } = await import("../models/modules/units.js");
      const { Op } = await import("sequelize");
      
      const totalUnitsInModule = await Units.count({
        where: { module_id: moduleId },
      });

      // Count unique viewed units in this module
      const viewedUnitsInModule = await LearnerActivityLog.findAll({
        where: {
          student_id: studentId,
          course_id: courseId,
          module_id: moduleId,
          activity_type: "unit_view",
        },
        attributes: ["unit_id"],
        group: ["unit_id"],
        raw: true,
      });

      // If all units viewed, mark module as completed
      if (viewedUnitsInModule.length >= totalUnitsInModule && totalUnitsInModule > 0) {
        // Check if module completion already logged
        const moduleCompleted = await LearnerActivityLog.findOne({
          where: {
            student_id: studentId,
            course_id: courseId,
            module_id: moduleId,
            activity_type: "module_completed",
          },
        });

        if (!moduleCompleted) {
          // Log module completion
          await LearnerActivityLog.create({
            student_id: studentId,
            activity_type: "module_completed",
            course_id: courseId,
            module_id: moduleId,
            tutor_id: tutorId,
            tutor_type: tutorType,
          });

          // Update completed modules count
          const completedModules = await LearnerActivityLog.findAll({
            where: {
              student_id: studentId,
              course_id: courseId,
              activity_type: "module_completed",
            },
            attributes: ["module_id"],
            group: ["module_id"],
            raw: true,
          });

          progress.completed_modules = completedModules.length;
        }
      }
    }

    // Check course completion (all modules completed)
    if (progress.total_modules > 0) {
      const completionPercentage =
        (progress.completed_modules / progress.total_modules) * 100;
      progress.completion_percentage = Math.min(100, completionPercentage);

      if (
        progress.completed_modules >= progress.total_modules &&
        progress.total_modules > 0 &&
        !progress.is_completed
      ) {
        progress.is_completed = true;
        progress.completed_at = new Date();

        // Log course completion
        await LearnerActivityLog.create({
          student_id: studentId,
          activity_type: "course_completed",
          course_id: courseId,
          tutor_id: tutorId,
          tutor_type: tutorType,
        });
      }
    }

    await progress.save();
  } catch (error) {
    console.error("Error updating course progress:", error.message);
  }
}

/**
 * Middleware to track login activity
 */
export const trackLogin = async (req, res, next) => {
  if (req.user?.userType === "student" && req.user?.id) {
    const studentId = req.user.id;
    const ipAddress =
      req.ip ||
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.connection?.remoteAddress;

    // Track login asynchronously (don't block request)
    trackLearnerActivity(
      {
        activityType: "login",
        studentId: studentId,
      },
      req
    ).catch((err) => {
      console.error("Error tracking login:", err.message);
    });
  }

  next();
};

