import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Program } from "../../models/program/program.js";
import { Courses } from "../../models/course/courses.js";
import { Faculty } from "../../models/faculty/faculty.js";
import { Op } from "sequelize";
import { Sequelize } from "sequelize";

/**
 * Get all programs that have published marketplace courses
 * GET /api/marketplace/programs
 * 
 * Returns a list of all programs that students can filter by
 * when browsing marketplace courses.
 */
export const getAllPrograms = TryCatchFunction(async (req, res) => {
  // This endpoint is public/student-accessible (no strict auth required)

  // Get all unique program_id values from published marketplace courses
  const publishedCourses = await Courses.findAll({
    where: {
      is_marketplace: true,
      marketplace_status: "published",
      program_id: { [Op.ne]: null }, // Only courses with a program
    },
    attributes: [
      "program_id",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "course_count"],
    ],
    group: ["program_id"],
    raw: true,
  });

  const programIds = publishedCourses.map((c) => c.program_id);

  // If no programs found, return empty array
  if (programIds.length === 0) {
    return res.status(200).json({
      status: true,
      code: 200,
      message: "Programs retrieved successfully",
      data: [],
      meta: {
        total: 0,
      },
    });
  }

  // Fetch programs (only active ones)
  const programs = await Program.findAll({
    where: {
      id: { [Op.in]: programIds },
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
      course_count: courseData ? parseInt(courseData.course_count) : 0,
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
      total: programsList.length,
    },
  });
});

