import { Op } from "sequelize";
import { Courses } from "../../../models/course/courses.js";
import { Program } from "../../../models/program/program.js";
import { Faculty } from "../../../models/faculty/faculty.js";
import { Staff } from "../../../models/auth/staff.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";

/**
 * Get all courses with pagination and filters
 */
export const getAllCourses = TryCatchFunction(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    program_id,
    faculty_id,
    staff_id,
    search,
    course_level,
    semester,
  } = req.query;

  const where = {};
  if (program_id) where.program_id = parseInt(program_id);
  if (faculty_id) where.faculty_id = parseInt(faculty_id);
  if (staff_id) where.staff_id = parseInt(staff_id);
  if (course_level) where.course_level = parseInt(course_level);
  if (semester) where.semester = semester;
  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { course_code: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows: courses } = await Courses.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: Program,
        as: "program",
        attributes: ["id", "title"],
      },
      {
        model: Faculty,
        as: "faculty",
        attributes: ["id", "name"],
      },
      {
        model: Staff,
        as: "instructor",
        attributes: ["id", "full_name", "email"],
      },
    ],
    order: [["id", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Courses retrieved successfully",
    data: {
      courses,
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
 * Get courses by program
 */
export const getCoursesByProgram = TryCatchFunction(async (req, res) => {
  const { programId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  // Verify program exists
  const program = await Program.findByPk(programId);
  if (!program) {
    throw new ErrorClass("Program not found", 404);
  }

  const offset = (page - 1) * limit;

  const { count, rows: courses } = await Courses.findAndCountAll({
    where: { program_id: programId },
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: Faculty,
        as: "faculty",
        attributes: ["id", "name"],
      },
      {
        model: Staff,
        as: "instructor",
        attributes: ["id", "full_name", "email"],
      },
    ],
    order: [
      ["course_level", "ASC"],
      ["course_code", "ASC"],
    ],
  });

  res.status(200).json({
    success: true,
    message: "Program courses retrieved successfully",
    data: {
      program: {
        id: program.id,
        title: program.title,
      },
      courses,
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
 * Get single course
 */
export const getCourseById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const course = await Courses.findByPk(id, {
    include: [
      {
        model: Program,
        as: "program",
        attributes: ["id", "title", "description"],
      },
      {
        model: Faculty,
        as: "faculty",
        attributes: ["id", "name", "description"],
      },
      {
        model: Staff,
        as: "instructor",
        attributes: ["id", "full_name", "email", "phone"],
      },
    ],
  });

  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Course retrieved successfully",
    data: {
      course,
    },
  });
});

/**
 * Create new course
 */
export const createCourse = TryCatchFunction(async (req, res) => {
  const {
    title,
    course_code,
    program_id,
    faculty_id,
    staff_id,
    course_unit,
    price,
    course_type,
    course_level,
    semester,
    exam_fee,
    currency = "NGN",
  } = req.body;

  if (!title || !course_code || !program_id || !staff_id) {
    throw new ErrorClass(
      "Title, course code, program ID, and staff ID are required",
      400
    );
  }

  // Verify program exists
  const program = await Program.findByPk(program_id);
  if (!program) {
    throw new ErrorClass("Program not found", 404);
  }

  // Verify staff exists
  const staff = await Staff.findByPk(staff_id);
  if (!staff) {
    throw new ErrorClass("Staff not found", 404);
  }

  // Verify faculty if provided
  if (faculty_id) {
    const faculty = await Faculty.findByPk(faculty_id);
    if (!faculty) {
      throw new ErrorClass("Faculty not found", 404);
    }
  }

  // Check if course code already exists
  const existingCourse = await Courses.findOne({
    where: { course_code: course_code.trim().toUpperCase() },
  });

  if (existingCourse) {
    throw new ErrorClass("Course with this code already exists", 409);
  }

  const course = await Courses.create({
    title: title.trim(),
    course_code: course_code.trim().toUpperCase(),
    program_id,
    faculty_id: faculty_id || program.faculty_id, // Use program's faculty if not specified
    staff_id,
    course_unit: course_unit || null,
    price: price || null,
    course_type: course_type || null,
    course_level: course_level || null,
    semester: semester || null,
    exam_fee: exam_fee || null,
    currency: currency || "NGN",
    date: new Date(),
  });

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "created_course",
        "course",
        course.id,
        {
          course_title: course.title,
          course_code: course.course_code,
          program_id: course.program_id,
        }
      );
    } else {
      console.warn("⚠️ req.user is undefined - cannot log admin activity");
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
    // Don't fail the request if logging fails
  }

  res.status(201).json({
    success: true,
    message: "Course created successfully",
    data: {
      course,
    },
  });
});

/**
 * Update course
 */
export const updateCourse = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    course_code,
    program_id,
    faculty_id,
    staff_id,
    course_unit,
    price,
    course_type,
    course_level,
    semester,
    exam_fee,
    currency,
  } = req.body;

  const course = await Courses.findByPk(id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  const oldData = {
    title: course.title,
    course_code: course.course_code,
    program_id: course.program_id,
    faculty_id: course.faculty_id,
    staff_id: course.staff_id,
    price: course.price,
  };

  // Verify program if being changed
  if (program_id && program_id !== course.program_id) {
    const program = await Program.findByPk(program_id);
    if (!program) {
      throw new ErrorClass("Program not found", 404);
    }
  }

  // Verify staff if being changed
  if (staff_id && staff_id !== course.staff_id) {
    const staff = await Staff.findByPk(staff_id);
    if (!staff) {
      throw new ErrorClass("Staff not found", 404);
    }
  }

  // Verify faculty if being changed
  if (faculty_id !== undefined && faculty_id !== course.faculty_id) {
    if (faculty_id) {
      const faculty = await Faculty.findByPk(faculty_id);
      if (!faculty) {
        throw new ErrorClass("Faculty not found", 404);
      }
    }
  }

  // Check if course code is being changed and if new code already exists
  if (course_code && course_code.trim().toUpperCase() !== course.course_code) {
    const existingCourse = await Courses.findOne({
      where: { course_code: course_code.trim().toUpperCase() },
    });
    if (existingCourse) {
      throw new ErrorClass("Course with this code already exists", 409);
    }
  }

  // Update course
  if (title) course.title = title.trim();
  if (course_code) course.course_code = course_code.trim().toUpperCase();
  if (program_id !== undefined) course.program_id = program_id;
  if (faculty_id !== undefined) course.faculty_id = faculty_id;
  if (staff_id !== undefined) course.staff_id = staff_id;
  if (course_unit !== undefined) course.course_unit = course_unit;
  if (price !== undefined) course.price = price;
  if (course_type !== undefined) course.course_type = course_type;
  if (course_level !== undefined) course.course_level = course_level;
  if (semester !== undefined) course.semester = semester;
  if (exam_fee !== undefined) course.exam_fee = exam_fee;
  if (currency !== undefined) course.currency = currency;

  await course.save();

  // Log activity
  await logAdminActivity(req.user.id, "updated_course", "course", id, {
    changes: {
      before: oldData,
      after: {
        title: course.title,
        course_code: course.course_code,
        program_id: course.program_id,
        faculty_id: course.faculty_id,
        staff_id: course.staff_id,
        price: course.price,
      },
    },
  });

  res.status(200).json({
    success: true,
    message: "Course updated successfully",
    data: {
      course,
    },
  });
});

/**
 * Delete course
 */
export const deleteCourse = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { hardDelete = false } = req.query;

  const course = await Courses.findByPk(id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  // TODO: Check if course has enrollments, modules, exams, etc.
  // For now, allow deletion but log warning

  if (hardDelete === "true") {
    await course.destroy();
    await logAdminActivity(req.user.id, "deleted_course", "course", id, {
      course_title: course.title,
      course_code: course.course_code,
      hard_delete: true,
    });

    res.status(200).json({
      success: true,
      message: "Course deleted permanently",
    });
  } else {
    // Soft delete - set program_id to null or mark as inactive
    // Since there's no status field, we'll set program_id to null
    const oldProgramId = course.program_id;
    course.program_id = null;
    await course.save();

    await logAdminActivity(req.user.id, "deleted_course", "course", id, {
      course_title: course.title,
      course_code: course.course_code,
      old_program_id: oldProgramId,
      soft_delete: true,
    });

    res.status(200).json({
      success: true,
      message: "Course removed from program (soft delete)",
      data: {
        course,
      },
    });
  }
});

/**
 * Get course statistics
 */
export const getCourseStats = TryCatchFunction(async (req, res) => {
  const totalCourses = await Courses.count();
  const coursesByProgram = await Courses.findAll({
    attributes: [
      "program_id",
      [
        Courses.sequelize.fn("COUNT", Courses.sequelize.col("Courses.id")),
        "count",
      ],
    ],
    include: [
      {
        model: Program,
        as: "program",
        attributes: ["title"],
      },
    ],
    group: ["program_id", "program.id"],
    raw: false,
  });

  const coursesByFaculty = await Courses.findAll({
    attributes: [
      "faculty_id",
      [
        Courses.sequelize.fn("COUNT", Courses.sequelize.col("Courses.id")),
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

  res.status(200).json({
    success: true,
    message: "Course statistics retrieved successfully",
    data: {
      total: totalCourses,
      byProgram: coursesByProgram,
      byFaculty: coursesByFaculty,
    },
  });
});
