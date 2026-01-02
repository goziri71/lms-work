import { Op } from "sequelize";
import { Courses } from "../../../models/course/courses.js";
import { Program } from "../../../models/program/program.js";
import { Faculty } from "../../../models/faculty/faculty.js";
import { Staff } from "../../../models/auth/staff.js";
import { CourseReg } from "../../../models/course_reg.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";
import multer from "multer";
import { supabase } from "../../../utils/supabase.js";

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
      cb(new ErrorClass("Only JPEG, PNG, and WebP images are allowed", 400), false);
    }
  },
});

// Middleware export
export const uploadCourseImageMiddleware = uploadCourseImage.single("image");

// Helper function to normalize category
const normalizeCategory = (category) => {
  if (!category) return null;
  
  const categoryMap = {
    "business": "Business",
    "tech": "Tech",
    "art": "Art",
    "logistics": "Logistics",
    "ebooks": "Ebooks",
    "podcast": "Podcast",
    "videos": "Videos",
    "music": "Music",
    "articles": "Articles",
    "code": "Code",
    "2d/3d files": "2D/3D Files",
    "2d files": "2D/3D Files",
    "3d files": "2D/3D Files",
  };
  
  const normalized = category.trim().toLowerCase();
  return categoryMap[normalized] || null;
};

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
    is_marketplace = false,
    marketplace_status,
    description,
    course_outline,
    duration_days,
    category,
    enrollment_limit,
    access_duration_days,
    image_url,
  } = req.body;

  // Required fields validation
  if (!title || !course_code || !program_id || !staff_id) {
    throw new ErrorClass(
      "Title, course code, program ID, and staff ID are required",
      400
    );
  }

  // For marketplace courses, require additional fields
  if (is_marketplace) {
    if (!description) {
      throw new ErrorClass("Description is required for marketplace courses", 400);
    }
    if (!course_outline) {
      throw new ErrorClass("Course outline/benefits is required for marketplace courses", 400);
    }
    if (!category) {
      throw new ErrorClass("Category is required for marketplace courses", 400);
    }
  }

  // Validate category if provided
  let normalizedCategory = null;
  if (category) {
    normalizedCategory = normalizeCategory(category);
    if (!normalizedCategory) {
      throw new ErrorClass(
        "Invalid category. Must be one of: Business, Tech, Art, Logistics, Ebooks, Podcast, Videos, Music, Articles, Code, 2D/3D Files",
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
      throw new ErrorClass("Access duration must be a positive number of days", 400);
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

  // Handle image upload if file is provided
  let finalImageUrl = image_url || null;
  if (req.file) {
    const bucket = process.env.COURSES_BUCKET || "courses";
    const timestamp = Date.now();
    const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const objectPath = `admin/courses/images/${timestamp}_${sanitizedFileName}`;

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

  // Validate marketplace fields if provided
  if (is_marketplace === true) {
    if (marketplace_status) {
      const validStatuses = ["draft", "pending", "approved", "rejected", "published"];
      if (!validStatuses.includes(marketplace_status)) {
        throw new ErrorClass(
          `marketplace_status must be one of: ${validStatuses.join(", ")}`,
          400
        );
      }
    }
    // If marketplace but no status, default to "draft"
    const finalMarketplaceStatus = marketplace_status || "draft";
    // If published, require price
    if (finalMarketplaceStatus === "published" && (!price || parseFloat(price) <= 0)) {
      throw new ErrorClass(
        "Course price must be set and greater than 0 for published marketplace courses",
        400
      );
    }
  }

  const course = await Courses.create({
    title: title.trim(),
    course_code: course_code.trim().toUpperCase(),
    program_id,
    faculty_id: faculty_id || program.faculty_id, // Use program's faculty if not specified
    staff_id,
    course_unit: course_unit || null,
    price: price || null,
    pricing_type: pricingType,
    course_type: course_type || null,
    course_level: course_level || null,
    semester: semester || null,
    exam_fee: exam_fee || null,
    currency: currency || "NGN",
    is_marketplace: is_marketplace || false,
    marketplace_status: is_marketplace ? (marketplace_status || "draft") : null,
    description: description ? description.trim() : null,
    course_outline: course_outline ? course_outline.trim() : null,
    duration_days: duration_days ? parseInt(duration_days) : null,
    image_url: finalImageUrl,
    category: normalizedCategory,
    enrollment_limit: enrollment_limit ? parseInt(enrollment_limit) : null,
    access_duration_days: access_duration_days ? parseInt(access_duration_days) : null,
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
 * Update course price
 * PUT /api/admin/courses/:id/price
 */
export const updateCoursePrice = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { price, currency } = req.body;

  if (!price) {
    throw new ErrorClass("Price is required", 400);
  }

  const course = await Courses.findByPk(id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  // Validate price is positive
  const priceNum = parseFloat(price);
  if (isNaN(priceNum) || priceNum < 0) {
    throw new ErrorClass("Price must be a positive number", 400);
  }

  const oldPrice = course.price;

  // Update course price
  course.price = priceNum.toString();
  if (currency) {
    course.currency = currency;
  }
  await course.save();

  // Log activity
  await logAdminActivity(req.user.id, "updated_course_price", "course", id, {
    changes: {
      before: {
        price: oldPrice,
        currency: course.currency,
      },
      after: {
        price: course.price,
        currency: course.currency,
      },
    },
    course_title: course.title,
    course_code: course.course_code,
  });

  res.status(200).json({
    success: true,
    message: "Course price updated successfully",
    data: {
      course: {
        id: course.id,
        title: course.title,
        course_code: course.course_code,
        price: parseFloat(course.price),
        currency: course.currency,
      },
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
    is_marketplace,
    marketplace_status,
    description,
    course_outline,
    duration_days,
    category,
    enrollment_limit,
    access_duration_days,
    image_url,
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
    is_marketplace: course.is_marketplace,
    marketplace_status: course.marketplace_status,
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

  // Validate marketplace fields
  if (is_marketplace !== undefined) {
    course.is_marketplace = is_marketplace;
    // If setting to marketplace, require marketplace_status
    if (is_marketplace === true && !marketplace_status) {
      // If not provided, default to "draft"
      if (course.marketplace_status === null || course.marketplace_status === undefined) {
        course.marketplace_status = "draft";
      }
    }
    // If setting to false, clear marketplace_status
    if (is_marketplace === false) {
      course.marketplace_status = null;
    }
  }

  if (marketplace_status !== undefined) {
    const validStatuses = ["draft", "pending", "approved", "rejected", "published"];
    if (marketplace_status && !validStatuses.includes(marketplace_status)) {
      throw new ErrorClass(
        `marketplace_status must be one of: ${validStatuses.join(", ")}`,
        400
      );
    }
    course.marketplace_status = marketplace_status;
    
    // If setting to published, require is_marketplace = true
    if (marketplace_status === "published") {
      course.is_marketplace = true;
      // Validate price is set for marketplace courses
      const finalPrice = price !== undefined ? price : course.price;
      if (!finalPrice || parseFloat(finalPrice) <= 0) {
        throw new ErrorClass(
          "Course price must be set and greater than 0 for marketplace courses",
          400
        );
      }
    }
  }

  // Validate category if provided
  let normalizedCategory = course.category;
  if (category !== undefined && category !== null) {
    normalizedCategory = normalizeCategory(category);
    if (!normalizedCategory) {
      throw new ErrorClass(
        "Invalid category. Must be one of: Business, Tech, Art, Logistics, Ebooks, Podcast, Videos, Music, Articles, Code, 2D/3D Files",
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
      throw new ErrorClass("Access duration must be a positive number of days", 400);
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
    const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const objectPath = `admin/courses/images/${timestamp}_${sanitizedFileName}`;

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
  if (title) course.title = title.trim();
  if (course_code) course.course_code = course_code.trim().toUpperCase();
  if (program_id !== undefined) course.program_id = program_id;
  if (faculty_id !== undefined) course.faculty_id = faculty_id;
  if (staff_id !== undefined) course.staff_id = staff_id;
  if (course_unit !== undefined) course.course_unit = course_unit;
  if (price !== undefined) {
    course.price = price;
    course.pricing_type = pricingType; // Auto-update pricing_type
  }
  if (course_type !== undefined) course.course_type = course_type;
  if (course_level !== undefined) course.course_level = course_level;
  if (semester !== undefined) course.semester = semester;
  if (exam_fee !== undefined) course.exam_fee = exam_fee;
  if (currency !== undefined) course.currency = currency;
  if (description !== undefined) course.description = description ? description.trim() : null;
  if (course_outline !== undefined) course.course_outline = course_outline ? course_outline.trim() : null;
  if (duration_days !== undefined) course.duration_days = duration_days ? parseInt(duration_days) : null;
  if (image_url !== undefined || req.file) course.image_url = finalImageUrl;
  if (category !== undefined) course.category = normalizedCategory;
  if (enrollment_limit !== undefined) course.enrollment_limit = enrollment_limit ? parseInt(enrollment_limit) : null;
  if (access_duration_days !== undefined) course.access_duration_days = access_duration_days ? parseInt(access_duration_days) : null;

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
        is_marketplace: course.is_marketplace,
        marketplace_status: course.marketplace_status,
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

  // Use paranoid: false to find course even if it's soft-deleted
  const course = await Courses.findByPk(id, { paranoid: false });
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  // Check if course is already deleted
  if (course.deleted_at) {
    throw new ErrorClass("Course is already deleted", 400);
  }

  // Check if course has enrollments
  const enrollmentCount = await CourseReg.count({
    where: {
      course_id: id,
      registration_status: { [Op.in]: ["registered", "marketplace_purchased"] },
    },
  });

  if (enrollmentCount > 0) {
    throw new ErrorClass(
      `Cannot delete course with ${enrollmentCount} active enrollment(s). Unpublish the course instead.`,
      400
    );
  }

  if (hardDelete === "true") {
    // Hard delete - permanently remove from database
    await course.destroy({ force: true });
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
    // Soft delete - sets deleted_at timestamp
    await course.destroy();
    await logAdminActivity(req.user.id, "deleted_course", "course", id, {
      course_title: course.title,
      course_code: course.course_code,
      soft_delete: true,
    });

    res.status(200).json({
      success: true,
      message: "Course deleted successfully (soft delete). It can be restored if needed.",
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
