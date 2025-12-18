import { Op } from "sequelize";
import { SchoolFeesConfiguration } from "../../../models/payment/schoolFeesConfiguration.js";
import { Students } from "../../../models/auth/student.js";
import { Program } from "../../../models/program/program.js";
import { Faculty } from "../../../models/faculty/faculty.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";

/**
 * Set school fees configuration for an academic year
 * POST /api/admin/school-fees/configuration
 */
export const setSchoolFeesConfiguration = TryCatchFunction(async (req, res) => {
  const {
    academic_year,
    level,
    program_id,
    faculty_id,
    amount,
    currency,
    description,
    is_active,
  } = req.body || {};

  if (!academic_year || !amount) {
    throw new ErrorClass("academic_year and amount are required", 400);
  }

  // Validate amount is positive
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum < 0) {
    throw new ErrorClass("amount must be a positive number", 400);
  }

  // Validate: Cannot have both program_id and faculty_id (or need to clarify logic)
  // For now, allow both but program_id takes precedence
  if (program_id) {
    const program = await Program.findByPk(program_id);
    if (!program) {
      throw new ErrorClass("Program not found", 404);
    }
  }

  if (faculty_id) {
    const faculty = await Faculty.findByPk(faculty_id);
    if (!faculty) {
      throw new ErrorClass("Faculty not found", 404);
    }
  }

  // Check if configuration already exists
  const where = {
    academic_year: academic_year.toString(),
    level: level ? level.toString() : null,
    program_id: program_id || null,
    faculty_id: faculty_id || null,
  };

  const existingConfig = await SchoolFeesConfiguration.findOne({ where });

  let config;
  if (existingConfig) {
    // Update existing configuration
    await existingConfig.update({
      amount: amountNum,
      currency: currency || "NGN",
      description: description || null,
      is_active: is_active !== undefined ? is_active : existingConfig.is_active,
    });
    config = existingConfig;
  } else {
    // Create new configuration
    config = await SchoolFeesConfiguration.create({
      academic_year: academic_year.toString(),
      level: level ? level.toString() : null,
      program_id: program_id || null,
      faculty_id: faculty_id || null,
      amount: amountNum,
      currency: currency || "NGN",
      description: description || null,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?.id || null,
    });
  }

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        existingConfig ? "updated_school_fees_config" : "set_school_fees_config",
        "school_fees",
        config.id,
        {
          academic_year: config.academic_year,
          level: config.level,
          program_id: config.program_id,
          faculty_id: config.faculty_id,
          amount: amountNum,
          currency: config.currency,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(existingConfig ? 200 : 201).json({
    success: true,
    message: existingConfig
      ? "School fees configuration updated successfully"
      : "School fees configuration set successfully",
    data: {
      configuration: {
        id: config.id,
        academic_year: config.academic_year,
        level: config.level,
        program_id: config.program_id,
        faculty_id: config.faculty_id,
        amount: parseFloat(config.amount),
        currency: config.currency,
        is_active: config.is_active,
        description: config.description,
        created_at: config.created_at,
        updated_at: config.updated_at,
      },
    },
  });
});

/**
 * Get school fees configurations
 * GET /api/admin/school-fees/configuration
 */
export const getSchoolFeesConfigurations = TryCatchFunction(async (req, res) => {
  const { academic_year, level, program_id, faculty_id, is_active } = req.query;

  const where = {};
  if (academic_year) where.academic_year = academic_year.toString();
  if (level) where.level = level.toString();
  if (program_id) where.program_id = parseInt(program_id);
  if (faculty_id) where.faculty_id = parseInt(faculty_id);
  if (is_active !== undefined) where.is_active = is_active === "true";

  // Fetch configurations without associations to avoid association errors
  const configurations = await SchoolFeesConfiguration.findAll({
    where,
    attributes: ["id", "academic_year", "level", "program_id", "faculty_id", "amount", "currency", "is_active", "description", "created_at", "updated_at"],
    order: [
      ["academic_year", "DESC"],
      ["level", "ASC"],
      ["program_id", "ASC"],
    ],
  });

  // Fetch program and faculty details separately if IDs exist
  const programIds = [...new Set(configurations.map(c => c.program_id).filter(Boolean))];
  const facultyIds = [...new Set(configurations.map(c => c.faculty_id).filter(Boolean))];

  const programs = programIds.length > 0 ? await Program.findAll({
    where: { id: { [Op.in]: programIds } },
    attributes: ["id", "name", "code"],
  }) : [];

  const faculties = facultyIds.length > 0 ? await Faculty.findAll({
    where: { id: { [Op.in]: facultyIds } },
    attributes: ["id", "name", "code"],
  }) : [];

  // Create lookup maps
  const programMap = new Map(programs.map(p => [p.id, p]));
  const facultyMap = new Map(faculties.map(f => [f.id, f]));

  res.status(200).json({
    success: true,
    message: "School fees configurations retrieved successfully",
    data: {
      configurations: configurations.map((config) => {
        const program = config.program_id ? programMap.get(config.program_id) : null;
        const faculty = config.faculty_id ? facultyMap.get(config.faculty_id) : null;

        return {
          id: config.id,
          academic_year: config.academic_year,
          level: config.level,
          program: program
            ? {
                id: program.id,
                name: program.name,
                code: program.code,
              }
            : null,
          faculty: faculty
            ? {
                id: faculty.id,
                name: faculty.name,
                code: faculty.code,
              }
            : null,
          amount: parseFloat(config.amount),
          currency: config.currency,
          is_active: config.is_active,
          description: config.description,
          created_at: config.created_at,
          updated_at: config.updated_at,
        };
      }),
      count: configurations.length,
    },
  });
});

/**
 * Get school fees configuration for a specific student
 * Helper function - can be used internally
 */
export const getSchoolFeesForStudent = async (student, academicYear) => {
  // Priority: program + level > faculty + level > level only > program only > faculty only > default (all)
  const configs = await SchoolFeesConfiguration.findAll({
    where: {
      academic_year: academicYear.toString(),
      is_active: true,
    },
    include: [
      {
        model: Program,
        as: "program",
        required: false,
      },
      {
        model: Faculty,
        as: "faculty",
        required: false,
      },
    ],
  });

  // Find most specific match
  let bestMatch = null;
  let bestScore = 0;

  for (const config of configs) {
    let score = 0;
    let matches = true;

    // Check program match
    if (config.program_id) {
      if (student.program_id === config.program_id) {
        score += 4; // Highest priority
      } else {
        matches = false;
      }
    }

    // Check faculty match
    if (config.faculty_id) {
      if (student.facaulty_id === config.faculty_id) {
        score += 2;
      } else if (!config.program_id) {
        // Only fail if no program_id specified
        matches = false;
      }
    }

    // Check level match
    if (config.level) {
      if (student.level === config.level) {
        score += 1;
      } else {
        matches = false;
      }
    }

    if (matches && score > bestScore) {
      bestScore = score;
      bestMatch = config;
    }
  }

  return bestMatch;
};

