import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { Program } from "../../models/program/program.js";
import { Faculty } from "../../models/faculty/faculty.js";
import { Staff } from "../../models/auth/staff.js";
import { Op, Sequelize } from "sequelize";
import { db } from "../../database/database.js";

/**
 * Get all courses created by tutor
 * GET /api/marketplace/tutor/courses
 */
export const getMyCourses = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const {
    page = 1,
    limit = 20,
    status,
    search,
  } = req.query;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const where = {
    owner_type: ownerType,
    owner_id: ownerId,
    is_marketplace: true,
  };

  if (status) {
    where.marketplace_status = status;
  }

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
        required: false,
      },
      {
        model: Faculty,
        as: "faculty",
        attributes: ["id", "name"],
        required: false,
      },
    ],
    order: [["id", "DESC"]],
  });

  // Get enrollment counts for each course
  const courseIds = courses.map((c) => c.id);
  const enrollments = await CourseReg.findAll({
    where: {
      course_id: { [Op.in]: courseIds },
      registration_status: "marketplace_purchased",
      academic_year: null,
      semester: null,
    },
    attributes: [
      "course_id",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "enrollment_count"],
    ],
    group: ["course_id"],
    raw: true,
  });

  const enrollmentMap = {};
  enrollments.forEach((e) => {
    enrollmentMap[e.course_id] = parseInt(e.enrollment_count || 0);
  });

  const coursesWithEnrollments = courses.map((course) => {
    const courseData = course.toJSON();
    return {
      ...courseData,
      enrollment_count: enrollmentMap[course.id] || 0,
      price: parseFloat(courseData.price || 0),
    };
  });

  res.status(200).json({
    success: true,
    message: "Courses retrieved successfully",
    data: {
      courses: coursesWithEnrollments,
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
 * Get single course details
 * GET /api/marketplace/tutor/courses/:id
 */
export const getCourseById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const course = await Courses.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
      is_marketplace: true,
    },
    include: [
      {
        model: Program,
        as: "program",
        attributes: ["id", "title"],
        required: false,
      },
      {
        model: Faculty,
        as: "faculty",
        attributes: ["id", "name"],
        required: false,
      },
    ],
  });

  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  // Get enrollment count
  const enrollmentCount = await CourseReg.count({
    where: {
      course_id: id,
      registration_status: "marketplace_purchased",
      academic_year: null,
      semester: null,
    },
  });

  const courseData = course.toJSON();
  courseData.enrollment_count = enrollmentCount;
  courseData.price = parseFloat(courseData.price || 0);

  res.status(200).json({
    success: true,
    message: "Course retrieved successfully",
    data: {
      course: courseData,
    },
  });
});

/**
 * Create new course
 * POST /api/marketplace/tutor/courses
 */
export const createCourse = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const {
    title,
    course_code,
    course_unit,
    price,
    course_type,
    course_level,
    semester,
    program_id,
    faculty_id,
    currency = "NGN",
    marketplace_status = "draft",
    description,
  } = req.body;

  // Validation
  if (!title || !course_code) {
    throw new ErrorClass("Title and course code are required", 400);
  }

  if (marketplace_status === "published" && (!price || parseFloat(price) <= 0)) {
    throw new ErrorClass("Published courses must have a price greater than 0", 400);
  }

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  // Use a transaction to ensure atomicity and prevent race conditions
  const transaction = await db.transaction({
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  });

  try {
    // Check if course code already exists for this tutor (scoped to tutor's courses only)
    // Using transaction to ensure this check and insert are atomic
    const existingCourse = await Courses.findOne({
      where: {
        course_code: course_code.trim(),
        owner_type: ownerType,
        owner_id: ownerId,
        is_marketplace: true, // Only check marketplace courses
      },
      transaction,
    });

    if (existingCourse) {
      await transaction.rollback();
      throw new ErrorClass("Course code already exists for your account", 409);
    }

    // Validate program_id if provided
    if (program_id) {
      const program = await Program.findByPk(program_id, { transaction });
      if (!program) {
        await transaction.rollback();
        throw new ErrorClass("Program not found", 404);
      }
    }

    // Validate faculty_id if provided
    if (faculty_id) {
      const faculty = await Faculty.findByPk(faculty_id, { transaction });
      if (!faculty) {
        await transaction.rollback();
        throw new ErrorClass("Faculty not found", 404);
      }
    }

    // For marketplace courses, staff_id is required but not meaningful
    // Find a valid staff member - retry with timeout handling
    let staffId = null;
    let retries = 3;
    let defaultStaff = null;
    let lastError = null;

    while (retries > 0 && !staffId) {
      try {
        defaultStaff = await Staff.findOne({
          order: [["id", "ASC"]],
          transaction,
        });
        if (defaultStaff) {
          staffId = defaultStaff.id;
          break;
        } else {
          // No staff found in database
          retries = 0; // Exit loop
        }
      } catch (error) {
        lastError = error;
        retries--;
        if (retries === 0) {
          break; // Exit loop to handle error below
        }
        // Wait a bit before retrying (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 100 * (4 - retries)));
      }
    }

    if (!staffId) {
      await transaction.rollback();
      if (lastError) {
        throw new ErrorClass(
          "Unable to find a valid staff member. Please contact support.",
          500
        );
      } else {
        throw new ErrorClass(
          "No staff members found in the system. Please contact support.",
          500
        );
      }
    }

    // Create course within transaction
    const course = await Courses.create(
      {
        title: title.trim(),
        course_code: course_code.trim(),
        course_unit: course_unit || null,
        price: price ? String(price) : "0",
        course_type: course_type || null,
        course_level: course_level || null,
        semester: semester || null,
        program_id: program_id || null,
        faculty_id: faculty_id || null,
        staff_id: staffId,
        currency: currency,
        owner_type: ownerType,
        owner_id: ownerId,
        is_marketplace: true,
        marketplace_status: marketplace_status,
        date: new Date(),
      },
      { transaction }
    );

    // Commit transaction
    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: {
        course: {
          id: course.id,
          title: course.title,
          course_code: course.course_code,
          marketplace_status: course.marketplace_status,
          price: parseFloat(course.price || 0),
        },
      },
    });
  } catch (error) {
    // Rollback transaction on any error
    await transaction.rollback();

    // Re-throw ErrorClass instances as-is
    if (error instanceof ErrorClass) {
      throw error;
    }

    // Handle database constraint violations
    if (error.name === "SequelizeUniqueConstraintError") {
      throw new ErrorClass("Course code already exists for your account", 409);
    }

    if (error.name === "SequelizeForeignKeyConstraintError") {
      throw new ErrorClass(
        "Invalid reference (program, faculty, or staff). Please check your selections.",
        400
      );
    }

    // Re-throw other errors
    throw error;
  }
});

/**
 * Update course
 * PUT /api/marketplace/tutor/courses/:id
 */
export const updateCourse = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const course = await Courses.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
      is_marketplace: true,
    },
  });

  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  const {
    title,
    course_code,
    course_unit,
    price,
    course_type,
    course_level,
    semester,
    program_id,
    faculty_id,
    currency,
    marketplace_status,
  } = req.body;

  // Validation for published status
  if (marketplace_status === "published") {
    const newPrice = price ? parseFloat(price) : parseFloat(course.price || 0);
    if (newPrice <= 0) {
      throw new ErrorClass("Published courses must have a price greater than 0", 400);
    }
  }

  // Check course code uniqueness if changed (scoped to tutor's courses only)
  if (course_code && course_code !== course.course_code) {
    const existingCourse = await Courses.findOne({
      where: {
        course_code: course_code.trim(),
        owner_type: ownerType,
        owner_id: ownerId,
        is_marketplace: true, // Only check marketplace courses
        id: { [Op.ne]: id },
      },
    });

    if (existingCourse) {
      throw new ErrorClass("Course code already exists for your account", 409);
    }
  }

  // Update course
  const updateData = {};
  if (title !== undefined) updateData.title = title.trim();
  if (course_code !== undefined) updateData.course_code = course_code.trim();
  if (course_unit !== undefined) updateData.course_unit = course_unit;
  if (price !== undefined) updateData.price = String(price);
  if (course_type !== undefined) updateData.course_type = course_type;
  if (course_level !== undefined) updateData.course_level = course_level;
  if (semester !== undefined) updateData.semester = semester;
  if (program_id !== undefined) updateData.program_id = program_id;
  if (faculty_id !== undefined) updateData.faculty_id = faculty_id;
  if (currency !== undefined) updateData.currency = currency;
  if (marketplace_status !== undefined) updateData.marketplace_status = marketplace_status;

  await course.update(updateData);

  res.status(200).json({
    success: true,
    message: "Course updated successfully",
    data: {
      course: {
        id: course.id,
        title: course.title,
        course_code: course.course_code,
        marketplace_status: course.marketplace_status,
        price: parseFloat(course.price || 0),
      },
    },
  });
});

/**
 * Delete course
 * DELETE /api/marketplace/tutor/courses/:id
 */
export const deleteCourse = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const course = await Courses.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
      is_marketplace: true,
    },
  });

  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  // Check if course has enrollments
  const enrollmentCount = await CourseReg.count({
    where: {
      course_id: id,
      registration_status: "marketplace_purchased",
    },
  });

  if (enrollmentCount > 0) {
    throw new ErrorClass(
      "Cannot delete course with existing enrollments. Unpublish the course instead.",
      400
    );
  }

  await course.destroy();

  res.status(200).json({
    success: true,
    message: "Course deleted successfully",
  });
});

/**
 * Update course status (publish/unpublish)
 * PATCH /api/marketplace/tutor/courses/:id/status
 */
export const updateCourseStatus = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { marketplace_status } = req.body;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  if (!["draft", "published"].includes(marketplace_status)) {
    throw new ErrorClass("Invalid status. Must be 'draft' or 'published'", 400);
  }

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const course = await Courses.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
      is_marketplace: true,
    },
  });

  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  // Validation for publishing
  if (marketplace_status === "published") {
    const price = parseFloat(course.price || 0);
    if (price <= 0) {
      throw new ErrorClass("Cannot publish course without a valid price", 400);
    }
  }

  await course.update({ marketplace_status });

  res.status(200).json({
    success: true,
    message: `Course ${marketplace_status === "published" ? "published" : "unpublished"} successfully`,
    data: {
      course: {
        id: course.id,
        title: course.title,
        marketplace_status: course.marketplace_status,
      },
    },
  });
});

