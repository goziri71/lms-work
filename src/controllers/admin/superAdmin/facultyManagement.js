import crypto from "crypto";
import { Faculty } from "../../../models/faculty/faculty.js";
import { Program } from "../../../models/program/program.js";
import { Courses } from "../../../models/course/courses.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";

/**
 * Get all faculties with pagination and filters
 */
export const getAllFaculties = TryCatchFunction(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;

  const where = {};
  if (search) {
    where[Faculty.sequelize.Op.or] = [
      { name: { [Faculty.sequelize.Op.iLike]: `%${search}%` } },
      { description: { [Faculty.sequelize.Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows: faculties } = await Faculty.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: Program,
        as: "programs",
        attributes: ["id", "title"],
        required: false,
      },
    ],
    order: [["id", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Faculties retrieved successfully",
    data: {
      faculties,
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
 * Get single faculty with programs and courses
 */
export const getFacultyById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const faculty = await Faculty.findByPk(id, {
    include: [
      {
        model: Program,
        as: "programs",
        attributes: ["id", "title", "description", "status"],
        include: [
          {
            model: Courses,
            as: "courses",
            attributes: ["id", "title", "course_code"],
            required: false,
          },
        ],
      },
      {
        model: Courses,
        as: "courses",
        attributes: ["id", "title", "course_code", "course_unit"],
        required: false,
      },
    ],
  });

  if (!faculty) {
    throw new ErrorClass("Faculty not found", 404);
  }

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "viewed_faculty", "faculty", id, {
        faculty_name: faculty.name,
      });
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Faculty retrieved successfully",
    data: {
      faculty,
      programCount: faculty.programs?.length || 0,
      courseCount: faculty.courses?.length || 0,
    },
  });
});

/**
 * Create new faculty
 */
export const createFaculty = TryCatchFunction(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    throw new ErrorClass("Faculty name is required", 400);
  }

  // Description is required by the model
  if (!description || !description.trim()) {
    throw new ErrorClass("Faculty description is required", 400);
  }

  // Check if faculty with same name exists
  const existingFaculty = await Faculty.findOne({
    where: { name: name.trim() },
  });

  if (existingFaculty) {
    throw new ErrorClass("Faculty with this name already exists", 409);
  }

  // Generate a unique token for the faculty
  const token = crypto.randomBytes(32).toString("hex");

  let faculty;
  try {
    // Don't pass date - let the database default handle it (model has defaultValue: DataTypes.NOW)
    faculty = await Faculty.create({
      name: name.trim(),
      description: description.trim(),
      token: token,
    });
  } catch (error) {
    // Log the detailed error for debugging
    console.error("Faculty creation error details:", {
      message: error.message,
      name: error.name,
      errors: error.errors,
      original: error.original,
      stack: error.stack,
    });
    // Re-throw with more context
    if (error.errors && error.errors.length > 0) {
      const validationErrors = error.errors.map(e => `${e.path}: ${e.message}`).join(", ");
      throw new ErrorClass(`Validation failed: ${validationErrors}`, 400);
    }
    throw error;
  }

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "created_faculty", "faculty", faculty.id, {
        faculty_name: faculty.name,
      });
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(201).json({
    success: true,
    message: "Faculty created successfully",
    data: {
      faculty,
    },
  });
});

/**
 * Update faculty
 */
export const updateFaculty = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  const faculty = await Faculty.findByPk(id);
  if (!faculty) {
    throw new ErrorClass("Faculty not found", 404);
  }

  const oldData = {
    name: faculty.name,
    description: faculty.description,
  };

  // Check if name is being changed and if new name already exists
  if (name && name.trim() !== faculty.name) {
    const existingFaculty = await Faculty.findOne({
      where: { name: name.trim() },
    });
    if (existingFaculty) {
      throw new ErrorClass("Faculty with this name already exists", 409);
    }
  }

  // Update faculty
  if (name) faculty.name = name.trim();
  if (description !== undefined) faculty.description = description?.trim() || null;

  await faculty.save();

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "updated_faculty", "faculty", id, {
        changes: {
          before: oldData,
          after: {
            name: faculty.name,
            description: faculty.description,
          },
        },
      });
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Faculty updated successfully",
    data: {
      faculty,
    },
  });
});

/**
 * Delete faculty
 */
export const deleteFaculty = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { hardDelete = false } = req.query;

  const faculty = await Faculty.findByPk(id, {
    include: [
      {
        model: Program,
        as: "programs",
        attributes: ["id"],
      },
      {
        model: Courses,
        as: "courses",
        attributes: ["id"],
      },
    ],
  });

  if (!faculty) {
    throw new ErrorClass("Faculty not found", 404);
  }

  // Check if faculty has programs or courses
  if (faculty.programs && faculty.programs.length > 0) {
    throw new ErrorClass(
      `Cannot delete faculty. It has ${faculty.programs.length} program(s) associated. Please remove programs first or reassign them.`,
      400
    );
  }

  if (faculty.courses && faculty.courses.length > 0) {
    throw new ErrorClass(
      `Cannot delete faculty. It has ${faculty.courses.length} course(s) associated. Please remove courses first or reassign them.`,
      400
    );
  }

  if (hardDelete === "true") {
    // Hard delete
    await faculty.destroy();
    try {
      if (req.user && req.user.id) {
        await logAdminActivity(req.user.id, "deleted_faculty", "faculty", id, {
          faculty_name: faculty.name,
          hard_delete: true,
        });
      }
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }

    res.status(200).json({
      success: true,
      message: "Faculty deleted permanently",
    });
  } else {
    // For now, just delete (no soft delete field in faculty table)
    await faculty.destroy();
    try {
      if (req.user && req.user.id) {
        await logAdminActivity(req.user.id, "deleted_faculty", "faculty", id, {
          faculty_name: faculty.name,
        });
      }
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }

    res.status(200).json({
      success: true,
      message: "Faculty deleted successfully",
    });
  }
});

/**
 * Get faculty statistics
 */
export const getFacultyStats = TryCatchFunction(async (req, res) => {
  const totalFaculties = await Faculty.count();

  // Faculties with program counts
  const facultiesWithPrograms = await Faculty.findAll({
    attributes: [
      "id",
      "name",
      [
        Faculty.sequelize.fn("COUNT", Faculty.sequelize.col("programs.id")),
        "program_count",
      ],
    ],
    include: [
      {
        model: Program,
        as: "programs",
        attributes: [],
        required: false,
      },
    ],
    group: ["Faculty.id"],
    order: [[Faculty.sequelize.literal("program_count"), "DESC"]],
  });

  // Faculties with course counts
  const facultiesWithCourses = await Faculty.findAll({
    attributes: [
      "id",
      "name",
      [
        Faculty.sequelize.fn("COUNT", Faculty.sequelize.col("courses.id")),
        "course_count",
      ],
    ],
    include: [
      {
        model: Courses,
        as: "courses",
        attributes: [],
        required: false,
      },
    ],
    group: ["Faculty.id"],
    order: [[Faculty.sequelize.literal("course_count"), "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Faculty statistics retrieved successfully",
    data: {
      total: totalFaculties,
      byPrograms: facultiesWithPrograms,
      byCourses: facultiesWithCourses,
    },
  });
});

