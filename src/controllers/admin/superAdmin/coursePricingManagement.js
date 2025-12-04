import { Op } from "sequelize";
import { Courses } from "../../../models/course/courses.js";
import { CourseSemesterPricing } from "../../../models/course/courseSemesterPricing.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";

/**
 * Set course price for a specific semester
 * POST /api/admin/courses/pricing
 */
export const setCoursePrice = TryCatchFunction(async (req, res) => {
  const { course_id, academic_year, semester, price, currency } = req.body || {};

  if (!course_id || !academic_year || !semester || !price) {
    throw new ErrorClass(
      "course_id, academic_year, semester, and price are required",
      400
    );
  }

  // Validate course exists
  const course = await Courses.findByPk(course_id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  // Validate price is positive
  const priceNum = parseFloat(price);
  if (isNaN(priceNum) || priceNum < 0) {
    throw new ErrorClass("Price must be a positive number", 400);
  }

  // Check if pricing already exists
  const existingPricing = await CourseSemesterPricing.findOne({
    where: {
      course_id,
      academic_year: academic_year.toString(),
      semester: semester.toString(),
    },
  });

  let pricing;
  if (existingPricing) {
    // Update existing pricing
    await existingPricing.update({
      price: priceNum,
      currency: currency || "NGN",
    });
    pricing = existingPricing;
  } else {
    // Create new pricing
    pricing = await CourseSemesterPricing.create({
      course_id,
      academic_year: academic_year.toString(),
      semester: semester.toString(),
      price: priceNum,
      currency: currency || "NGN",
      created_by: req.user?.id || null,
    });
  }

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        existingPricing ? "updated_course_price" : "set_course_price",
        "course",
        course_id,
        {
          course_title: course.title,
          course_code: course.course_code,
          academic_year: academic_year.toString(),
          semester: semester.toString(),
          price: priceNum,
          currency: currency || "NGN",
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(existingPricing ? 200 : 201).json({
    success: true,
    message: existingPricing
      ? "Course price updated successfully"
      : "Course price set successfully",
    data: {
      pricing: {
        id: pricing.id,
        course_id: pricing.course_id,
        course_title: course.title,
        course_code: course.course_code,
        academic_year: pricing.academic_year,
        semester: pricing.semester,
        price: parseFloat(pricing.price),
        currency: pricing.currency,
      },
    },
  });
});

/**
 * Bulk set course prices for a semester
 * POST /api/admin/courses/pricing/bulk
 */
export const bulkSetCoursePrices = TryCatchFunction(async (req, res) => {
  const { academic_year, semester, pricing, currency } = req.body || {};

  if (!academic_year || !semester || !pricing || !Array.isArray(pricing)) {
    throw new ErrorClass(
      "academic_year, semester, and pricing array are required",
      400
    );
  }

  if (pricing.length === 0) {
    throw new ErrorClass("Pricing array cannot be empty", 400);
  }

  const results = {
    created: 0,
    updated: 0,
    errors: [],
  };

  // Process each pricing entry
  for (const item of pricing) {
    try {
      if (!item.course_id || item.price === undefined) {
        results.errors.push({
          course_id: item.course_id,
          error: "course_id and price are required",
        });
        continue;
      }

      // Validate course exists
      const course = await Courses.findByPk(item.course_id);
      if (!course) {
        results.errors.push({
          course_id: item.course_id,
          error: "Course not found",
        });
        continue;
      }

      const priceNum = parseFloat(item.price);
      if (isNaN(priceNum) || priceNum < 0) {
        results.errors.push({
          course_id: item.course_id,
          error: "Invalid price",
        });
        continue;
      }

      // Check if pricing exists
      const existingPricing = await CourseSemesterPricing.findOne({
        where: {
          course_id: item.course_id,
          academic_year: academic_year.toString(),
          semester: semester.toString(),
        },
      });

      if (existingPricing) {
        await existingPricing.update({
          price: priceNum,
          currency: item.currency || currency || "NGN",
        });
        results.updated++;
      } else {
        await CourseSemesterPricing.create({
          course_id: item.course_id,
          academic_year: academic_year.toString(),
          semester: semester.toString(),
          price: priceNum,
          currency: item.currency || currency || "NGN",
          created_by: req.user?.id || null,
        });
        results.created++;
      }
    } catch (error) {
      results.errors.push({
        course_id: item.course_id,
        error: error.message,
      });
    }
  }

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "bulk_set_course_prices",
        "course",
        null,
        {
          academic_year: academic_year.toString(),
          semester: semester.toString(),
          total: pricing.length,
          created: results.created,
          updated: results.updated,
          errors: results.errors.length,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: `Bulk pricing completed: ${results.created} created, ${results.updated} updated`,
    data: {
      summary: results,
    },
  });
});

/**
 * Get course prices for a semester
 * GET /api/admin/courses/pricing
 */
export const getCoursePrices = TryCatchFunction(async (req, res) => {
  const { academic_year, semester, course_id, program_id } = req.query;

  const where = {};
  if (academic_year) where.academic_year = academic_year.toString();
  if (semester) where.semester = semester.toString();
  if (course_id) where.course_id = course_id;

  const include = [
    {
      model: Courses,
      as: "course",
      attributes: ["id", "title", "course_code", "course_unit", "program_id"],
      ...(program_id && {
        where: { program_id: parseInt(program_id) },
      }),
    },
  ];

  const pricing = await CourseSemesterPricing.findAll({
    where,
    include,
    order: [
      ["academic_year", "DESC"],
      ["semester", "DESC"],
      [{ model: Courses, as: "course" }, "course_code", "ASC"],
    ],
  });

  res.status(200).json({
    success: true,
    message: "Course prices retrieved successfully",
    data: {
      pricing: pricing.map((p) => ({
        id: p.id,
        course_id: p.course_id,
        course_title: p.course?.title,
        course_code: p.course?.course_code,
        course_unit: p.course?.course_unit,
        academic_year: p.academic_year,
        semester: p.semester,
        price: parseFloat(p.price),
        currency: p.currency,
        created_at: p.created_at || p.createdAt,
        updated_at: p.updated_at || p.updatedAt,
      })),
      count: pricing.length,
    },
  });
});

/**
 * Copy pricing from one semester to another
 * POST /api/admin/courses/pricing/copy
 */
export const copyCoursePrices = TryCatchFunction(async (req, res) => {
  const {
    from_academic_year,
    from_semester,
    to_academic_year,
    to_semester,
  } = req.body || {};

  if (
    !from_academic_year ||
    !from_semester ||
    !to_academic_year ||
    !to_semester
  ) {
    throw new ErrorClass(
      "from_academic_year, from_semester, to_academic_year, and to_semester are required",
      400
    );
  }

  // Get source pricing
  const sourcePricing = await CourseSemesterPricing.findAll({
    where: {
      academic_year: from_academic_year.toString(),
      semester: from_semester.toString(),
    },
  });

  if (sourcePricing.length === 0) {
    throw new ErrorClass(
      `No pricing found for ${from_academic_year} - ${from_semester}`,
      404
    );
  }

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Copy each pricing
  for (const source of sourcePricing) {
    try {
      // Check if target pricing already exists
      const existing = await CourseSemesterPricing.findOne({
        where: {
          course_id: source.course_id,
          academic_year: to_academic_year.toString(),
          semester: to_semester.toString(),
        },
      });

      if (existing) {
        // Update existing
        await existing.update({
          price: source.price,
          currency: source.currency,
        });
        results.updated++;
      } else {
        // Create new
        await CourseSemesterPricing.create({
          course_id: source.course_id,
          academic_year: to_academic_year.toString(),
          semester: to_semester.toString(),
          price: source.price,
          currency: source.currency,
          created_by: req.user?.id || null,
        });
        results.created++;
      }
    } catch (error) {
      results.errors.push({
        course_id: source.course_id,
        error: error.message,
      });
    }
  }

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "copied_course_prices",
        "course",
        null,
        {
          from: `${from_academic_year} - ${from_semester}`,
          to: `${to_academic_year} - ${to_semester}`,
          total: sourcePricing.length,
          created: results.created,
          updated: results.updated,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: `Pricing copied: ${results.created} created, ${results.updated} updated`,
    data: {
      summary: results,
      source_count: sourcePricing.length,
    },
  });
});

/**
 * Get price for a specific course in a semester
 * Helper function - can be used internally
 */
export const getCoursePriceForSemester = async (
  courseId,
  academicYear,
  semester
) => {
  const pricing = await CourseSemesterPricing.findOne({
    where: {
      course_id: courseId,
      academic_year: academicYear.toString(),
      semester: semester.toString(),
    },
  });

  if (pricing) {
    return parseFloat(pricing.price);
  }

  // Fallback to course base price if no semester pricing
  const course = await Courses.findByPk(courseId);
  if (course && course.price) {
    return parseFloat(course.price);
  }

  return 0;
};

