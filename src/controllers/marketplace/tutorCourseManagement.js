import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { Program } from "../../models/program/program.js";
import { Faculty } from "../../models/faculty/faculty.js";
import { Staff } from "../../models/auth/staff.js";
import { Op, Sequelize } from "sequelize";
import { Sequelize as SequelizeLib } from "sequelize";
import { db } from "../../database/database.js";
import multer from "multer";
import { supabase } from "../../utils/supabase.js";
import { generateCourseSlug } from "../../utils/productSlugHelper.js";

// Configure multer for course image uploads
const uploadCourseImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ErrorClass("Only JPEG, PNG, and WebP images are allowed", 400),
        false
      );
    }
  },
});

// Middleware export
export const uploadCourseImageMiddleware = uploadCourseImage.single("image");

import { normalizeCategory, CATEGORIES } from "../../constants/categories.js";

const COURSE_CODE_MAX_LENGTH = 6;
const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generate a random 6-character alphanumeric course code (unique per tutor).
 * @param {number} ownerId - tutor_id or organization id
 * @param {string} ownerType - "sole_tutor" or "organization"
 * @param {object} [transaction] - optional Sequelize transaction
 * @returns {Promise<string>} - 6-char uppercase code
 */
async function generateUniqueCourseCodeForTutor(
  ownerId,
  ownerType,
  transaction = null
) {
  const opts = transaction ? { transaction } : {};
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < COURSE_CODE_MAX_LENGTH; i++) {
      code += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
    }
    const existing = await Courses.findOne({
      where: {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn("UPPER", Sequelize.col("course_code")),
            code
          ),
          { owner_id: ownerId },
          { owner_type: ownerType },
          { is_marketplace: true },
        ],
      },
      ...opts,
      paranoid: true,
    });
    if (!existing) return code;
  }
  throw new ErrorClass(
    "Could not generate a unique course code. Please try again.",
    500
  );
}

/**
 * Get all courses created by tutor
 * GET /api/marketplace/tutor/courses
 */
export const getMyCourses = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const { page = 1, limit = 20, status, search } = req.query;

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
      // Only search course_code if it's not null
      {
        course_code: {
          [Op.iLike]: `%${search}%`,
          [Op.ne]: null,
        },
      },
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
    course_outline,
    duration_days,
    category,
    enrollment_limit,
    access_duration_days,
    image_url, // Can be provided as URL or uploaded as file
  } = req.body;

  // Validation - Required fields
  if (!title) {
    throw new ErrorClass("Title is required", 400);
  }

  if (!description) {
    throw new ErrorClass("Description is required", 400);
  }

  if (!course_outline) {
    throw new ErrorClass("Course outline/benefits is required", 400);
  }

  if (!category) {
    throw new ErrorClass("Category is required", 400);
  }

  if (
    marketplace_status === "published" &&
    (!price || parseFloat(price) <= 0)
  ) {
    throw new ErrorClass(
      "Published courses must have a price greater than 0",
      400
    );
  }

  // Validate category
  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) {
    throw new ErrorClass(
      `Invalid category. Must be one of: ${CATEGORIES.join(", ")}`,
      400
    );
  }

  // Validate enrollment_limit if provided
  if (enrollment_limit !== undefined && enrollment_limit !== null) {
    const limitNum = parseInt(enrollment_limit);
    if (isNaN(limitNum) || limitNum <= 0) {
      throw new ErrorClass("Enrollment limit must be a positive number", 400);
    }
  }

  // Validate access_duration_days if provided
  if (access_duration_days !== undefined && access_duration_days !== null) {
    const durationNum = parseInt(access_duration_days);
    if (isNaN(durationNum) || durationNum <= 0) {
      throw new ErrorClass(
        "Access duration must be a positive number of days",
        400
      );
    }
  }

  // Validate duration_days if provided
  if (duration_days !== undefined && duration_days !== null) {
    const durationNum = parseInt(duration_days);
    if (isNaN(durationNum) || durationNum <= 0) {
      throw new ErrorClass("Duration must be a positive number of days", 400);
    }
  }

  // Auto-set pricing_type based on price
  const priceNum = price ? parseFloat(price) : 0;
  const pricingType = priceNum === 0 ? "free" : "one_time";

  // Check subscription limits and expiration
  try {
    const { checkSubscriptionLimit, validateSubscriptionStatus } = await import(
      "./tutorSubscription.js"
    );

    // Determine tutor type
    let tutorType;
    if (userType === "sole_tutor") {
      tutorType = "sole_tutor";
    } else if (
      userType === "organization" ||
      userType === "organization_user"
    ) {
      tutorType = "organization";
      if (userType === "organization_user") {
        tutorId = tutor.organization_id;
      }
    } else {
      throw new ErrorClass("Invalid user type", 403);
    }

    // Check subscription status (expiration)
    const statusCheck = await validateSubscriptionStatus(tutorId, tutorType);
    if (!statusCheck.allowed) {
      throw new ErrorClass(statusCheck.reason, 403);
    }

    // Check subscription limit for courses
    const limitCheck = await checkSubscriptionLimit(
      tutorId,
      tutorType,
      "course"
    );
    if (!limitCheck.allowed) {
      throw new ErrorClass(limitCheck.reason, 403);
    }
  } catch (error) {
    // If it's already an ErrorClass, rethrow it
    if (error instanceof ErrorClass) {
      throw error;
    }
    // If subscription tables don't exist, log warning but continue
    console.warn("Subscription check failed:", error.message);
  }

  // Handle image upload if file is provided
  let finalImageUrl = image_url || null;
  if (req.file) {
    const bucket = process.env.COURSES_BUCKET || "courses";
    const timestamp = Date.now();
    const sanitizedFileName = req.file.originalname.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    );
    const ext = req.file.mimetype?.split("/")[1] || "jpg";
    const objectPath = `tutors/${tutorId}/images/${timestamp}_${sanitizedFileName}`;

    // Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new ErrorClass(`Image upload failed: ${uploadError.message}`, 500);
    }

    // Generate signed URL for private bucket (expires in 1 year)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 31536000); // 1 year expiration

    if (urlError) {
      // Fallback to public URL if signed URL fails (for public buckets)
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(objectPath);
      finalImageUrl = urlData.publicUrl;
    } else {
      // Use signed URL for private bucket
      finalImageUrl = signedUrlData.signedUrl;
    }
  }

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  // Use a transaction to ensure atomicity
  const transaction = await db.transaction();

  try {
    // Normalize course_code: treat null, undefined, empty string, and whitespace-only as "no code"
    const normalizedCourseCode =
      course_code && typeof course_code === "string"
        ? course_code.trim()
        : null;

    // If tutor provided a code: must be at most 6 characters; check uniqueness, auto-generate if duplicate
    let finalCourseCode;
    if (normalizedCourseCode && normalizedCourseCode.length > 0) {
      if (normalizedCourseCode.length > COURSE_CODE_MAX_LENGTH) {
        await transaction.rollback();
        throw new ErrorClass(
          `Course code must be at most ${COURSE_CODE_MAX_LENGTH} characters`,
          400
        );
      }
      const trimmedCode = normalizedCourseCode.toUpperCase();
      const existingCourse = await Courses.findOne({
        where: {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("UPPER", Sequelize.col("course_code")),
              trimmedCode
            ),
            { owner_type: ownerType },
            { owner_id: ownerId },
            { is_marketplace: true },
          ],
        },
        transaction,
        paranoid: true,
      });
      if (existingCourse) {
        // Duplicate detected - auto-generate a unique code instead of erroring
        finalCourseCode = await generateUniqueCourseCodeForTutor(
          ownerId,
          ownerType,
          transaction
        );
      } else {
        finalCourseCode = normalizedCourseCode;
      }
    } else {
      // No code provided - auto-generate 6-char code unique per tutor
      finalCourseCode = await generateUniqueCourseCodeForTutor(
        ownerId,
        ownerType,
        transaction
      );
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
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * (4 - retries))
        );
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

    // Create course within transaction (finalCourseCode already set above: from body or auto-generated)
    // Generate unique slug (generateCourseSlug checks DB and appends -1, -2 etc if needed)
    const slug = await generateCourseSlug(title.trim());

    const course = await Courses.create(
      {
        title: title.trim(),
        slug: slug,
        course_code: finalCourseCode,
        course_unit: course_unit || null,
        price: price ? String(price) : "0",
        pricing_type: pricingType,
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
        description: description.trim(),
        course_outline: course_outline.trim(),
        duration_days: duration_days ? parseInt(duration_days) : null,
        image_url: finalImageUrl,
        category: normalizedCategory,
        enrollment_limit: enrollment_limit ? parseInt(enrollment_limit) : null,
        access_duration_days: access_duration_days
          ? parseInt(access_duration_days)
          : null,
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
          description: course.description,
          course_outline: course.course_outline,
          pricing_type: course.pricing_type,
          price: parseFloat(course.price || 0),
          duration_days: course.duration_days,
          image_url: course.image_url,
          category: course.category,
          enrollment_limit: course.enrollment_limit,
          access_duration_days: course.access_duration_days,
          marketplace_status: course.marketplace_status,
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
      console.error("SequelizeUniqueConstraintError details:", {
        fields: error.fields,
        errors: error.errors?.map(e => ({ field: e.path, value: e.value, message: e.message })),
        message: error.message,
        parent: error.parent?.detail,
      });
      throw new ErrorClass("A course with this title already exists. Please try a different title.", 409);
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
    description,
    course_outline,
    duration_days,
    category,
    enrollment_limit,
    access_duration_days,
    image_url,
  } = req.body;

  // Validation for published status
  if (marketplace_status === "published") {
    const newPrice = price ? parseFloat(price) : parseFloat(course.price || 0);
    if (newPrice <= 0) {
      throw new ErrorClass(
        "Published courses must have a price greater than 0",
        400
      );
    }
  }

  // Validate category if provided
  let normalizedCategory = course.category;
  if (category !== undefined && category !== null) {
    normalizedCategory = normalizeCategory(category);
    if (!normalizedCategory) {
      throw new ErrorClass(
        `Invalid category. Must be one of: ${CATEGORIES.join(", ")}`,
        400
      );
    }
  }

  // Validate enrollment_limit if provided
  if (enrollment_limit !== undefined && enrollment_limit !== null) {
    const limitNum = parseInt(enrollment_limit);
    if (isNaN(limitNum) || limitNum <= 0) {
      throw new ErrorClass("Enrollment limit must be a positive number", 400);
    }
  }

  // Validate access_duration_days if provided
  if (access_duration_days !== undefined && access_duration_days !== null) {
    const durationNum = parseInt(access_duration_days);
    if (isNaN(durationNum) || durationNum <= 0) {
      throw new ErrorClass(
        "Access duration must be a positive number of days",
        400
      );
    }
  }

  // Validate duration_days if provided
  if (duration_days !== undefined && duration_days !== null) {
    const durationNum = parseInt(duration_days);
    if (isNaN(durationNum) || durationNum <= 0) {
      throw new ErrorClass("Duration must be a positive number of days", 400);
    }
  }

  // Handle image upload if file is provided
  let finalImageUrl = image_url !== undefined ? image_url : course.image_url;
  if (req.file) {
    const bucket = process.env.COURSES_BUCKET || "courses";
    const timestamp = Date.now();
    const sanitizedFileName = req.file.originalname.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    );
    const objectPath = `tutors/${tutorId}/images/${timestamp}_${sanitizedFileName}`;

    // Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new ErrorClass(`Image upload failed: ${uploadError.message}`, 500);
    }

    // Generate signed URL for private bucket (expires in 1 year)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 31536000); // 1 year expiration

    if (urlError) {
      // Fallback to public URL if signed URL fails (for public buckets)
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(objectPath);
      finalImageUrl = urlData.publicUrl;
    } else {
      // Use signed URL for private bucket
      finalImageUrl = signedUrlData.signedUrl;
    }
  }

  // Auto-update pricing_type based on price
  let pricingType = course.pricing_type;
  if (price !== undefined) {
    const priceNum = price ? parseFloat(price) : 0;
    pricingType = priceNum === 0 ? "free" : "one_time";
  }

  // Update course
  const updateData = {};
  if (title !== undefined) {
    updateData.title = title.trim();
    // Regenerate slug if title changed
    if (title.trim() !== course.title) {
      updateData.slug = await generateCourseSlug(title.trim(), course.id);
    }
  }
  // Course code: validate max 6 chars, uniqueness per tutor; auto-generate if duplicate or cleared
  if (course_code !== undefined) {
    const trimmed =
      course_code && typeof course_code === "string" ? course_code.trim() : "";
    if (trimmed.length > 0) {
      if (trimmed.length > COURSE_CODE_MAX_LENGTH) {
        throw new ErrorClass(
          `Course code must be at most ${COURSE_CODE_MAX_LENGTH} characters`,
          400
        );
      }
      const trimmedCode = trimmed.toUpperCase();
      const currentCode = course.course_code?.toUpperCase() || null;
      if (trimmedCode !== currentCode) {
        const existingCourse = await Courses.findOne({
          where: {
            [Op.and]: [
              Sequelize.where(
                Sequelize.fn("UPPER", Sequelize.col("course_code")),
                trimmedCode
              ),
              { owner_type: ownerType },
              { owner_id: ownerId },
              { is_marketplace: true },
              { id: { [Op.ne]: parseInt(id) } },
            ],
          },
          paranoid: true,
        });
        if (existingCourse) {
          // Duplicate detected - auto-generate a unique code instead of erroring
          updateData.course_code = await generateUniqueCourseCodeForTutor(
            ownerId,
            ownerType
          );
        } else {
          updateData.course_code = trimmed;
        }
      } else {
        updateData.course_code = trimmed;
      }
    } else {
      // Empty/null: auto-generate a new 6-char code unique per tutor
      updateData.course_code = await generateUniqueCourseCodeForTutor(
        ownerId,
        ownerType
      );
    }
  }
  if (course_unit !== undefined) updateData.course_unit = course_unit;
  if (price !== undefined) {
    updateData.price = String(price);
    updateData.pricing_type = pricingType; // Auto-update pricing_type
  }
  if (course_type !== undefined) updateData.course_type = course_type;
  if (course_level !== undefined) updateData.course_level = course_level;
  if (semester !== undefined) updateData.semester = semester;
  if (program_id !== undefined) updateData.program_id = program_id;
  if (faculty_id !== undefined) updateData.faculty_id = faculty_id;
  if (currency !== undefined) updateData.currency = currency;
  if (marketplace_status !== undefined)
    updateData.marketplace_status = marketplace_status;
  if (description !== undefined) updateData.description = description.trim();
  if (course_outline !== undefined)
    updateData.course_outline = course_outline.trim();
  if (duration_days !== undefined)
    updateData.duration_days = duration_days ? parseInt(duration_days) : null;
  if (image_url !== undefined || req.file) updateData.image_url = finalImageUrl;
  if (category !== undefined) updateData.category = normalizedCategory;
  if (enrollment_limit !== undefined)
    updateData.enrollment_limit = enrollment_limit
      ? parseInt(enrollment_limit)
      : null;
  if (access_duration_days !== undefined)
    updateData.access_duration_days = access_duration_days
      ? parseInt(access_duration_days)
      : null;

  await course.update(updateData);

  res.status(200).json({
    success: true,
    message: "Course updated successfully",
    data: {
      course: {
        id: course.id,
        title: course.title,
        course_code: course.course_code,
        description: course.description,
        course_outline: course.course_outline,
        pricing_type: course.pricing_type,
        price: parseFloat(course.price || 0),
        duration_days: course.duration_days,
        image_url: course.image_url,
        category: course.category,
        enrollment_limit: course.enrollment_limit,
        access_duration_days: course.access_duration_days,
        marketplace_status: course.marketplace_status,
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

  await course.destroy({ force: true });

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
    message: `Course ${
      marketplace_status === "published" ? "published" : "unpublished"
    } successfully`,
    data: {
      course: {
        id: course.id,
        title: course.title,
        marketplace_status: course.marketplace_status,
      },
    },
  });
});
