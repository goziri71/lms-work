import { Notice } from "../../../models/notice/notice.js";
import { Courses } from "../../../models/course/courses.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";

/**
 * Get all notices with pagination and filters
 */
export const getAllNotices = TryCatchFunction(async (req, res) => {
  const { page = 1, limit = 20, course_id, search } = req.query;

  const where = {};
  if (course_id) where.course_id = course_id;
  if (search) {
    where[Notice.sequelize.Op.or] = [
      { title: { [Notice.sequelize.Op.iLike]: `%${search}%` } },
      { note: { [Notice.sequelize.Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  // Try with all attributes first, fallback to base columns if migration hasn't run
  let result;
  try {
    result = await Notice.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      include: [
        {
          model: Courses,
          as: "course",
          attributes: ["id", "title", "course_code"],
          required: false,
        },
      ],
      order: [["date", "DESC"]],
    });
  } catch (error) {
    // If columns don't exist yet (migration not run), use only base columns
    if (error.message && error.message.includes("does not exist")) {
      result = await Notice.findAndCountAll({
        where,
        attributes: ["id", "title", "note", "date", "token", "course_id"],
        limit: parseInt(limit),
        offset,
        include: [
          {
            model: Courses,
            as: "course",
            attributes: ["id", "title", "course_code"],
            required: false,
          },
        ],
        order: [["date", "DESC"]],
      });
    } else {
      throw error;
    }
  }

  const { count, rows: notices } = result;

  res.status(200).json({
    success: true,
    message: "Notices retrieved successfully",
    data: {
      notices,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    },
  });
});

/**
 * Get single notice
 */
export const getNoticeById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  // Try with all attributes first, fallback to base columns if migration hasn't run
  let notice;
  try {
    notice = await Notice.findByPk(id, {
      include: [
        {
          model: Courses,
          as: "course",
          attributes: ["id", "title", "course_code"],
        },
      ],
    });
  } catch (error) {
    // If columns don't exist yet (migration not run), use only base columns
    if (error.message && error.message.includes("does not exist")) {
      notice = await Notice.findByPk(id, {
        attributes: ["id", "title", "note", "date", "token", "course_id"],
        include: [
          {
            model: Courses,
            as: "course",
            attributes: ["id", "title", "course_code"],
          },
        ],
      });
    } else {
      throw error;
    }
  }

  if (!notice) {
    throw new ErrorClass("Notice not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Notice retrieved successfully",
    data: {
      notice,
    },
  });
});

/**
 * Create new notice with expiration control
 */
export const createNotice = TryCatchFunction(async (req, res) => {
  const {
    title,
    note,
    course_id,
    is_permanent = false,
    expires_at,
    duration_days,
    status = "active",
    target_audience = "all",
  } = req.body;

  if (!title || !note) {
    throw new ErrorClass("Title and note are required", 400);
  }

  // Validate target_audience
  const validAudiences = ["all", "students", "staff", "both"];
  if (!validAudiences.includes(target_audience)) {
    throw new ErrorClass(
      `target_audience must be one of: ${validAudiences.join(", ")}`,
      400
    );
  }

  // Validate status
  const validStatuses = ["active", "expired", "draft"];
  if (!validStatuses.includes(status)) {
    throw new ErrorClass(
      `status must be one of: ${validStatuses.join(", ")}`,
      400
    );
  }

  // Verify course if provided
  if (course_id) {
    const course = await Courses.findByPk(course_id);
    if (!course) {
      throw new ErrorClass("Course not found", 404);
    }
  }

  // Calculate expires_at based on options
  let finalExpiresAt = null;
  if (is_permanent) {
    // Permanent notice - no expiration
    finalExpiresAt = null;
  } else if (expires_at) {
    // Specific expiration date provided
    finalExpiresAt = new Date(expires_at);
    if (isNaN(finalExpiresAt.getTime())) {
      throw new ErrorClass("Invalid expires_at date format", 400);
    }
  } else if (duration_days) {
    // Duration in days provided - calculate expiration
    const duration = parseInt(duration_days);
    if (isNaN(duration) || duration <= 0) {
      throw new ErrorClass("duration_days must be a positive number", 400);
    }
    finalExpiresAt = new Date();
    finalExpiresAt.setDate(finalExpiresAt.getDate() + duration);
  }
  // If none provided, notice is permanent by default (backward compatible)

  // Build create data
  const createData = {
    title: title.trim(),
    note: note.trim(),
    course_id: course_id || null,
    date: new Date(),
  };

  // Try to include new columns, but handle gracefully if migration hasn't run
  try {
    const notice = await Notice.create({
      ...createData,
      is_permanent: !!is_permanent,
      expires_at: finalExpiresAt,
      status: status,
      target_audience: target_audience,
    });

    // Log activity
    try {
      if (req.user && req.user.id) {
        await logAdminActivity(
          req.user.id,
          "created_notice",
          "notice",
          notice.id,
          {
            notice_title: notice.title,
            course_id: notice.course_id,
            is_permanent: notice.is_permanent,
            expires_at: notice.expires_at,
            status: notice.status,
            target_audience: notice.target_audience,
          }
        );
      }
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }

    return res.status(201).json({
      success: true,
      message: "Notice created successfully",
      data: {
        notice,
      },
    });
  } catch (error) {
    // If columns don't exist yet (migration not run), create without them
    if (error.message && error.message.includes("does not exist")) {
      const notice = await Notice.create(createData);

      return res.status(201).json({
        success: true,
        message: "Notice created successfully",
        data: {
          notice,
        },
      });
    }
    throw error;
  }

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "created_notice",
        "notice",
        notice.id,
        {
          notice_title: notice.title,
          course_id: notice.course_id,
          is_permanent: notice.is_permanent,
          expires_at: notice.expires_at,
          status: notice.status,
          target_audience: notice.target_audience,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(201).json({
    success: true,
    message: "Notice created successfully",
    data: {
      notice,
    },
  });
});

/**
 * Update notice with expiration control
 */
export const updateNotice = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    note,
    course_id,
    is_permanent,
    expires_at,
    duration_days,
    status,
    target_audience,
  } = req.body;

  // Try to get notice with all fields, fallback to base fields if migration hasn't run
  let notice;
  let hasNewColumns = true;
  try {
    notice = await Notice.findByPk(id);
  } catch (error) {
    if (error.message && error.message.includes("does not exist")) {
      notice = await Notice.findByPk(id, {
        attributes: ["id", "title", "note", "date", "token", "course_id"],
      });
      hasNewColumns = false;
    } else {
      throw error;
    }
  }

  if (!notice) {
    throw new ErrorClass("Notice not found", 404);
  }

  const oldData = {
    title: notice.title,
    note: notice.note,
    course_id: notice.course_id,
  };

  // Only include new fields if columns exist
  if (hasNewColumns) {
    oldData.is_permanent = notice.is_permanent;
    oldData.expires_at = notice.expires_at;
    oldData.status = notice.status;
    oldData.target_audience = notice.target_audience;
  }

  // Verify course if being changed
  if (course_id !== undefined && course_id !== notice.course_id) {
    if (course_id) {
      const course = await Courses.findByPk(course_id);
      if (!course) {
        throw new ErrorClass("Course not found", 404);
      }
    }
  }

  // Validate target_audience if provided
  if (target_audience !== undefined) {
    const validAudiences = ["all", "students", "staff", "both"];
    if (!validAudiences.includes(target_audience)) {
      throw new ErrorClass(
        `target_audience must be one of: ${validAudiences.join(", ")}`,
        400
      );
    }
  }

  // Validate status if provided
  if (status !== undefined) {
    const validStatuses = ["active", "expired", "draft"];
    if (!validStatuses.includes(status)) {
      throw new ErrorClass(
        `status must be one of: ${validStatuses.join(", ")}`,
        400
      );
    }
  }

  // Update basic fields (always available)
  if (title !== undefined) notice.title = title.trim();
  if (note !== undefined) notice.note = note.trim();
  if (course_id !== undefined) notice.course_id = course_id || null;

  // Update new fields only if columns exist
  if (hasNewColumns) {
    if (status !== undefined) notice.status = status;
    if (target_audience !== undefined) notice.target_audience = target_audience;

    // Handle expiration settings
    if (is_permanent !== undefined) {
      notice.is_permanent = !!is_permanent;
      if (notice.is_permanent) {
        // If making permanent, clear expires_at
        notice.expires_at = null;
      }
    }

    // Calculate expires_at if needed
    if (!notice.is_permanent) {
      if (expires_at !== undefined) {
        if (expires_at === null) {
          notice.expires_at = null;
        } else {
          const newExpiresAt = new Date(expires_at);
          if (isNaN(newExpiresAt.getTime())) {
            throw new ErrorClass("Invalid expires_at date format", 400);
          }
          notice.expires_at = newExpiresAt;
        }
      } else if (duration_days !== undefined) {
        // Duration in days provided - calculate from current date or notice date
        const duration = parseInt(duration_days);
        if (isNaN(duration) || duration <= 0) {
          throw new ErrorClass("duration_days must be a positive number", 400);
        }
        const baseDate = notice.date || new Date();
        notice.expires_at = new Date(baseDate);
        notice.expires_at.setDate(notice.expires_at.getDate() + duration);
      }
    }
  }

  try {
    await notice.save();
  } catch (error) {
    // If save fails due to missing columns, only save base fields
    if (error.message && error.message.includes("does not exist")) {
      await notice.save({ fields: ["title", "note", "course_id"] });
    } else {
      throw error;
    }
  }

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "updated_notice", "notice", id, {
        changes: {
          before: oldData,
          after: {
            title: notice.title,
            note: notice.note,
            course_id: notice.course_id,
            is_permanent: notice.is_permanent,
            expires_at: notice.expires_at,
            status: notice.status,
            target_audience: notice.target_audience,
          },
        },
      });
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Notice updated successfully",
    data: {
      notice,
    },
  });
});

/**
 * Delete notice
 */
export const deleteNotice = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const notice = await Notice.findByPk(id);
  if (!notice) {
    throw new ErrorClass("Notice not found", 404);
  }

  await notice.destroy();

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "deleted_notice", "notice", id, {
        notice_title: notice.title,
      });
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Notice deleted successfully",
  });
});
