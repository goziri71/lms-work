import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { Faculty } from "../../models/faculty/faculty.js";
import { Program } from "../../models/program/program.js";
import { Op } from "sequelize";

/**
 * Get all available faculties for tutors to choose from
 * GET /api/marketplace/tutor/faculties
 * 
 * Returns a list of all faculties that tutors can select when creating/updating courses.
 * This is useful for organizational tutors who want to categorize their courses.
 */
export const getFaculties = TryCatchFunction(async (req, res) => {
  const { page = 1, limit = 100, search } = req.query;

  const where = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: faculties } = await Faculty.findAndCountAll({
    where,
    attributes: ["id", "name", "description"],
    order: [["name", "ASC"]],
    limit: parseInt(limit),
    offset,
  });

  res.status(200).json({
    success: true,
    message: "Faculties retrieved successfully",
    data: {
      faculties: faculties.map((faculty) => ({
        id: faculty.id,
        name: faculty.name,
        description: faculty.description,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

/**
 * Get all available programs for tutors to choose from
 * GET /api/marketplace/tutor/programs
 * 
 * Returns a list of all active programs that tutors can select when creating/updating courses.
 * This is useful for organizational tutors who want to categorize their courses.
 * 
 * Query Parameters:
 * - page (optional): Page number (default: 1)
 * - limit (optional): Items per page (default: 100)
 * - search (optional): Search by title or description
 * - faculty_id (optional): Filter programs by faculty
 */
export const getPrograms = TryCatchFunction(async (req, res) => {
  const { page = 1, limit = 100, search, faculty_id } = req.query;

  const where = {
    status: "Y", // Only return active programs
  };

  if (faculty_id) {
    where.faculty_id = parseInt(faculty_id);
  }

  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: programs } = await Program.findAndCountAll({
    where,
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
    offset,
  });

  res.status(200).json({
    success: true,
    message: "Programs retrieved successfully",
    data: {
      programs: programs.map((program) => ({
        id: program.id,
        title: program.title,
        description: program.description,
        faculty_id: program.faculty_id,
        faculty: program.faculty
          ? {
              id: program.faculty.id,
              name: program.faculty.name,
            }
          : null,
        status: program.status,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

