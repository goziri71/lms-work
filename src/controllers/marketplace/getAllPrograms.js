import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Program } from "../../models/program/program.js";
import { Courses } from "../../models/course/courses.js";
import { Faculty } from "../../models/faculty/faculty.js";
import { Op } from "sequelize";
import { Sequelize } from "sequelize";

/**
 * Get all active programs
 * GET /api/marketplace/programs
 * 
 * Returns a list of all active programs that students can filter by
 * when browsing marketplace courses. Includes course count for marketplace courses.
 * 
 * Query Parameters:
 * - page (optional): Page number (default: 1)
 * - limit (optional): Items per page (default: 20)
 */
export const getAllPrograms = TryCatchFunction(async (req, res) => {
  // This endpoint is public/student-accessible (no strict auth required)

  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Get all active programs with pagination
  const { count, rows: programs } = await Program.findAndCountAll({
    where: {
      status: "Y", // Only active programs (Y = Active, N = Inactive)
    },
    include: [
      {
        model: Faculty,
        as: "faculty",
        attributes: ["id", "name"],
        required: false,
      },
    ],
    attributes: ["id", "title", "description", "faculty_id", "status"],
    order: [["title", "ASC"]],
    limit: parseInt(limit),
    offset: offset,
  });

  // Get course counts for marketplace courses per program (for reference)
  const publishedCourses = await Courses.findAll({
    where: {
      is_marketplace: true,
      marketplace_status: "published",
      program_id: { [Op.ne]: null },
    },
    attributes: [
      "program_id",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "course_count"],
    ],
    group: ["program_id"],
    raw: true,
  });

  // Build response with course counts
  const programsList = programs.map((program) => {
    const courseData = publishedCourses.find(
      (c) => c.program_id === program.id
    );
    return {
      id: program.id,
      title: program.title,
      description: program.description,
      faculty_id: program.faculty_id,
      course_count: courseData ? parseInt(courseData.course_count) : 0, // Marketplace course count
      faculty: program.faculty
        ? {
            id: program.faculty.id,
            name: program.faculty.name,
          }
        : null,
    };
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Programs retrieved successfully",
    data: programsList,
    meta: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
      hasNextPage: parseInt(page) < Math.ceil(count / parseInt(limit)),
      hasPrevPage: parseInt(page) > 1,
    },
  });
});

