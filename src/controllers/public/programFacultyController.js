import { Program } from "../../models/program/program.js";
import { Faculty } from "../../models/faculty/faculty.js";
import { Courses } from "../../models/course/courses.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";

/**
 * Get program details by ID (Student-accessible)
 * GET /api/programs/:id
 * 
 * Requires student authentication
 * Returns program information including faculty and course count
 */
export const getProgramById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  // Validate that id is a number
  if (isNaN(parseInt(id))) {
    throw new ErrorClass("Invalid program ID", 400);
  }

  const program = await Program.findOne({
    where: {
      id: parseInt(id),
      status: "Y", // Only return active programs
    },
    include: [
      {
        model: Faculty,
        as: "faculty",
        attributes: ["id", "name", "description"],
        required: false,
      },
    ],
    attributes: ["id", "title", "description", "faculty_id", "status"],
  });

  if (!program) {
    throw new ErrorClass("Program not found or inactive", 404);
  }

  // Get course count for this program
  const courseCount = await Courses.count({
    where: {
      program_id: program.id,
      is_marketplace: false, // Only count WPU program courses, not marketplace
    },
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Program retrieved successfully",
    data: {
      program: {
        id: program.id,
        title: program.title,
        description: program.description,
        faculty_id: program.faculty_id,
        status: program.status,
        faculty: program.faculty
          ? {
              id: program.faculty.id,
              name: program.faculty.name,
              description: program.faculty.description,
            }
          : null,
        courseCount: courseCount,
      },
    },
  });
});

/**
 * Get faculty details by ID (Student-accessible)
 * GET /api/faculties/:id
 * 
 * Requires student authentication
 * Returns faculty information including programs
 */
export const getFacultyById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  // Validate that id is a number
  if (isNaN(parseInt(id))) {
    throw new ErrorClass("Invalid faculty ID", 400);
  }

  const faculty = await Faculty.findByPk(parseInt(id), {
    include: [
      {
        model: Program,
        as: "programs",
        where: {
          status: "Y", // Only return active programs
        },
        attributes: ["id", "title", "description", "status"],
        required: false,
      },
    ],
    attributes: ["id", "name", "description"],
  });

  if (!faculty) {
    throw new ErrorClass("Faculty not found", 404);
  }

  // Get course count for this faculty (only WPU courses, not marketplace)
  const courseCount = await Courses.count({
    where: {
      faculty_id: faculty.id,
      is_marketplace: false,
    },
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Faculty retrieved successfully",
    data: {
      faculty: {
        id: faculty.id,
        name: faculty.name,
        description: faculty.description,
        programs: faculty.programs || [],
        programCount: faculty.programs?.length || 0,
        courseCount: courseCount,
      },
    },
  });
});

