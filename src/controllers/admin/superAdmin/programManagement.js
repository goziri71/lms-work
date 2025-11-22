import { Op } from "sequelize";
import { Program } from "../../../models/program/program.js";
import { Courses } from "../../../models/course/courses.js";
import { Faculty } from "../../../models/faculty/faculty.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";

/**
 * Get all programs with pagination and filters
 */
export const getAllPrograms = TryCatchFunction(async (req, res) => {
  const { page = 1, limit = 20, status, search, faculty_id } = req.query;

  const where = {};
  if (status) where.status = status;
  if (faculty_id) where.faculty_id = faculty_id;
  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows: programs } = await Program.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: Faculty,
        as: "faculty",
        attributes: ["id", "name"],
      },
    ],
    order: [["id", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Programs retrieved successfully",
    data: {
      programs,
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
 * Get single program with all courses
 */
export const getProgramById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const program = await Program.findByPk(id, {
    include: [
      {
        model: Faculty,
        as: "faculty",
        attributes: ["id", "name", "description"],
      },
      {
        model: Courses,
        as: "courses",
        attributes: [
          "id",
          "title",
          "course_code",
          "course_unit",
          "price",
          "course_type",
          "course_level",
          "semester",
          "currency",
          "exam_fee",
        ],
        include: [
          {
            model: Faculty,
            as: "faculty",
            attributes: ["id", "name"],
          },
        ],
      },
    ],
  });

  if (!program) {
    throw new ErrorClass("Program not found", 404);
  }

  // Log activity
  await logAdminActivity(req.admin.id, "viewed_program", "program", id, {
    program_title: program.title,
  });

  res.status(200).json({
    success: true,
    message: "Program retrieved successfully",
    data: {
      program,
      courseCount: program.courses?.length || 0,
    },
  });
});

/**
 * Create new program
 */
export const createProgram = TryCatchFunction(async (req, res) => {
  const { title, description, faculty_id, status = "Y" } = req.body;

  if (!title) {
    throw new ErrorClass("Program title is required", 400);
  }

  // Check if program with same title exists
  const existingProgram = await Program.findOne({
    where: { title: title.trim() },
  });

  if (existingProgram) {
    throw new ErrorClass("Program with this title already exists", 409);
  }

  // Validate faculty if provided
  if (faculty_id) {
    const faculty = await Faculty.findByPk(faculty_id);
    if (!faculty) {
      throw new ErrorClass("Faculty not found", 404);
    }
  }

  const program = await Program.create({
    title: title.trim(),
    description: description?.trim() || null,
    faculty_id: faculty_id || null,
    status: status === "Y" ? "Y" : "N",
    date: new Date(),
  });

  // Log activity
  await logAdminActivity(
    req.admin.id,
    "created_program",
    "program",
    program.id,
    {
      program_title: program.title,
      faculty_id: program.faculty_id,
    }
  );

  res.status(201).json({
    success: true,
    message: "Program created successfully",
    data: {
      program,
    },
  });
});

/**
 * Update program
 */
export const updateProgram = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { title, description, faculty_id, status } = req.body;

  const program = await Program.findByPk(id);
  if (!program) {
    throw new ErrorClass("Program not found", 404);
  }

  const oldData = {
    title: program.title,
    description: program.description,
    faculty_id: program.faculty_id,
    status: program.status,
  };

  // Check if title is being changed and if new title already exists
  if (title && title.trim() !== program.title) {
    const existingProgram = await Program.findOne({
      where: { title: title.trim() },
    });
    if (existingProgram) {
      throw new ErrorClass("Program with this title already exists", 409);
    }
  }

  // Validate faculty if provided
  if (faculty_id && faculty_id !== program.faculty_id) {
    const faculty = await Faculty.findByPk(faculty_id);
    if (!faculty) {
      throw new ErrorClass("Faculty not found", 404);
    }
  }

  // Update program
  if (title) program.title = title.trim();
  if (description !== undefined)
    program.description = description?.trim() || null;
  if (faculty_id !== undefined) program.faculty_id = faculty_id || null;
  if (status !== undefined) program.status = status === "Y" ? "Y" : "N";

  await program.save();

  // Log activity
  await logAdminActivity(req.admin.id, "updated_program", "program", id, {
    changes: {
      before: oldData,
      after: {
        title: program.title,
        description: program.description,
        faculty_id: program.faculty_id,
        status: program.status,
      },
    },
  });

  res.status(200).json({
    success: true,
    message: "Program updated successfully",
    data: {
      program,
    },
  });
});

/**
 * Delete/Deactivate program
 */
export const deleteProgram = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { hardDelete = false } = req.query;

  const program = await Program.findByPk(id, {
    include: [
      {
        model: Courses,
        as: "courses",
        attributes: ["id"],
      },
    ],
  });

  if (!program) {
    throw new ErrorClass("Program not found", 404);
  }

  // Check if program has courses
  if (program.courses && program.courses.length > 0) {
    throw new ErrorClass(
      `Cannot delete program. It has ${program.courses.length} course(s) associated. Please remove courses first or deactivate the program.`,
      400
    );
  }

  if (hardDelete === "true") {
    // Hard delete
    await program.destroy();
    await logAdminActivity(req.admin.id, "deleted_program", "program", id, {
      program_title: program.title,
      hard_delete: true,
    });

    res.status(200).json({
      success: true,
      message: "Program deleted permanently",
    });
  } else {
    // Soft delete (deactivate)
    program.status = "N";
    await program.save();

    await logAdminActivity(req.admin.id, "deactivated_program", "program", id, {
      program_title: program.title,
    });

    res.status(200).json({
      success: true,
      message: "Program deactivated successfully",
      data: {
        program,
      },
    });
  }
});

/**
 * Get program statistics
 */
export const getProgramStats = TryCatchFunction(async (req, res) => {
  const totalPrograms = await Program.count();
  const activePrograms = await Program.count({ where: { status: "Y" } });
  const inactivePrograms = await Program.count({ where: { status: "N" } });

  // Programs by faculty
  const programsByFaculty = await Program.findAll({
    attributes: [
      "faculty_id",
      [
        Program.sequelize.fn("COUNT", Program.sequelize.col("Program.id")),
        "count",
      ],
    ],
    include: [
      {
        model: Faculty,
        as: "faculty",
        attributes: ["name"],
      },
    ],
    group: ["faculty_id", "faculty.id"],
    raw: false,
  });

  // Programs with course counts
  const programsWithCourses = await Program.findAll({
    attributes: [
      "id",
      "title",
      [
        Program.sequelize.fn("COUNT", Program.sequelize.col("courses.id")),
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
    group: ["Program.id"],
    order: [[Program.sequelize.literal("course_count"), "DESC"]],
    limit: 10,
  });

  res.status(200).json({
    success: true,
    message: "Program statistics retrieved successfully",
    data: {
      total: totalPrograms,
      active: activePrograms,
      inactive: inactivePrograms,
      byFaculty: programsByFaculty,
      topProgramsByCourses: programsWithCourses,
    },
  });
});
