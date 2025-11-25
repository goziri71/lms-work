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

  const { count, rows: notices } = await Notice.findAndCountAll({
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

  const notice = await Notice.findByPk(id, {
    include: [
      {
        model: Courses,
        as: "course",
        attributes: ["id", "title", "course_code"],
      },
    ],
  });

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
 * Create new notice
 */
export const createNotice = TryCatchFunction(async (req, res) => {
  const { title, note, course_id } = req.body;

  if (!title || !note) {
    throw new ErrorClass("Title and note are required", 400);
  }

  // Verify course if provided
  if (course_id) {
    const course = await Courses.findByPk(course_id);
    if (!course) {
      throw new ErrorClass("Course not found", 404);
    }
  }

  const notice = await Notice.create({
    title: title.trim(),
    note: note.trim(),
    course_id: course_id || null,
    date: new Date(),
  });

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "created_notice", "notice", notice.id, {
        notice_title: notice.title,
        course_id: notice.course_id,
      });
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
 * Update notice
 */
export const updateNotice = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { title, note, course_id } = req.body;

  const notice = await Notice.findByPk(id);
  if (!notice) {
    throw new ErrorClass("Notice not found", 404);
  }

  const oldData = {
    title: notice.title,
    note: notice.note,
    course_id: notice.course_id,
  };

  // Verify course if being changed
  if (course_id !== undefined && course_id !== notice.course_id) {
    if (course_id) {
      const course = await Courses.findByPk(course_id);
      if (!course) {
        throw new ErrorClass("Course not found", 404);
      }
    }
  }

  // Update notice
  if (title !== undefined) notice.title = title.trim();
  if (note !== undefined) notice.note = note.trim();
  if (course_id !== undefined) notice.course_id = course_id || null;

  await notice.save();

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

