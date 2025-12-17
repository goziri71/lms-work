import { Op } from "sequelize";
import { Semester } from "../../../models/auth/semester.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";
import { allocateCoursesToAllStudents } from "../../../services/automaticCourseAllocationService.js";

export const getAllSemesters = TryCatchFunction(async (req, res) => {
  const { page = 1, limit = 20, status, academic_year, semester } = req.query;

  const where = {};
  if (status) where.status = status;
  if (academic_year) where.academic_year = academic_year;
  if (semester) where.semester = semester;

  const offset = (page - 1) * limit;

  const { count, rows: semesters } = await Semester.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [
      ["academic_year", "DESC"],
      ["semester", "DESC"],
    ],
  });

  res.status(200).json({
    success: true,
    message: "Semesters retrieved successfully",
    data: {
      semesters,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    },
  });
});

export const getSemesterById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const semester = await Semester.findByPk(id);
  if (!semester) {
    throw new ErrorClass("Semester not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Semester retrieved successfully",
    data: {
      semester,
    },
  });
});

export const getCurrentSemester = TryCatchFunction(async (req, res) => {
  const currentDate = new Date();
  const today = currentDate.toISOString().split("T")[0];

  let semester = await Semester.findOne({
    where: {
      [Op.and]: [
        Semester.sequelize.literal(`DATE(start_date) <= '${today}'`),
        Semester.sequelize.literal(`DATE(end_date) >= '${today}'`),
      ],
    },
    order: [["id", "DESC"]],
  });

  if (!semester) {
    semester = await Semester.findOne({
      where: Semester.sequelize.where(
        Semester.sequelize.fn("UPPER", Semester.sequelize.col("status")),
        "ACTIVE"
      ),
      order: [["id", "DESC"]],
    });
  }

  if (!semester) {
    semester = await Semester.findOne({
      order: [["id", "DESC"]],
    });
  }

  res.status(200).json({
    success: true,
    message: "Current semester retrieved successfully",
    data: {
      semester,
    },
  });
});

export const createSemester = TryCatchFunction(async (req, res) => {
  const {
    academic_year,
    semester,
    start_date,
    end_date,
    status = "pending",
  } = req.body || {};

  if (!academic_year || !semester || !start_date || !end_date) {
    throw new ErrorClass(
      "Academic year, semester, start date, and end date are required",
      400
    );
  }

  if (
    semester !== 1 &&
    semester !== 2 &&
    semester !== "1" &&
    semester !== "2"
  ) {
    throw new ErrorClass("Semester must be 1 or 2", 400);
  }

  const startDate = new Date(start_date);
  const endDate = new Date(end_date);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new ErrorClass("Invalid date format", 400);
  }

  if (startDate >= endDate) {
    throw new ErrorClass("End date must be after start date", 400);
  }

  // Convert semester input (1 or 2) to database format ("1ST" or "2ND")
  const semesterValue = semester === 1 || semester === "1" ? "1ST" : "2ND";

  // academic_year is stored as VARCHAR (e.g., "2019/2020"), so compare as string
  // semester is stored as VARCHAR (e.g., "1ST", "2ND"), so compare as string
  const existingSemester = await Semester.findOne({
    where: {
      academic_year: academic_year,
      semester: semesterValue,
    },
  });

  if (existingSemester) {
    throw new ErrorClass(
      `Semester ${semesterValue} for academic year ${academic_year} already exists`,
      409
    );
  }

  // Get the current active semester to check if academic year changed
  const previousActiveSemester = await Semester.findOne({
    where: {
      status: "active",
    },
    order: [["id", "DESC"]],
  });

  if (status === "active") {
    await Semester.update(
      { status: "closed" },
      {
        where: {
          status: "active",
        },
      }
    );
  }

  // Format dates as YYYY-MM-DD strings (database columns are VARCHAR)
  const formattedStartDate = startDate.toISOString().split("T")[0];
  const formattedEndDate = endDate.toISOString().split("T")[0];

  // Use raw SQL to bypass Sequelize's type conversion for date fields
  // The database columns are VARCHAR, but Sequelize model defines them as DATE
  const [result] = await Semester.sequelize.query(
    `INSERT INTO "semester" ("academic_year", "semester", "start_date", "end_date", "status", "date") 
     VALUES (:academicYear, :semester, :startDate, :endDate, :status, NOW()) 
     RETURNING *`,
    {
      replacements: {
        academicYear: academic_year,
        semester: semesterValue,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        status: status,
      },
      type: Semester.sequelize.QueryTypes.SELECT,
    }
  );

  const newSemester = result[0];

  // NOTE: Level progression is now handled per-student during course registration
  // This is more efficient and scalable than bulk operations
  // See: src/services/studentLevelProgressionService.js

  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "created_semester",
        "semester",
        newSemester.id,
        {
          academic_year: newSemester.academic_year,
          semester: newSemester.semester,
          status: newSemester.status,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  // Automatically allocate courses if semester is created as "active"
  let allocationResult = null;
  if (status === "active") {
    try {
      allocationResult = await allocateCoursesToAllStudents(
        newSemester.academic_year,
        newSemester.semester
      );
      console.log(
        `✅ Automatic course allocation completed: ${allocationResult.allocated} allocated, ${allocationResult.skipped} skipped`
      );
    } catch (allocationError) {
      console.error("Error during automatic course allocation:", allocationError);
      // Don't fail the semester creation if allocation fails
    }
  }

  res.status(201).json({
    success: true,
    message: "Semester created successfully",
    data: {
      semester: newSemester,
      allocation: allocationResult
        ? {
            allocated: allocationResult.allocated,
            skipped: allocationResult.skipped,
            errors: allocationResult.errors?.length || 0,
          }
        : null,
    },
  });
});

export const updateSemester = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { academic_year, semester, start_date, end_date, status } =
    req.body || {};

  const semesterRecord = await Semester.findByPk(id);
  if (!semesterRecord) {
    throw new ErrorClass("Semester not found", 404);
  }

  const oldData = {
    academic_year: semesterRecord.academic_year,
    semester: semesterRecord.semester,
    start_date: semesterRecord.start_date,
    end_date: semesterRecord.end_date,
    status: semesterRecord.status,
  };

  if (start_date || end_date) {
    const startDate = start_date
      ? new Date(start_date)
      : semesterRecord.start_date;
    const endDate = end_date ? new Date(end_date) : semesterRecord.end_date;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ErrorClass("Invalid date format", 400);
    }

    if (startDate >= endDate) {
      throw new ErrorClass("End date must be after start date", 400);
    }
  }

  // Convert semester input (1 or 2) to database format ("1ST" or "2ND") if provided
  const semesterValue =
    semester !== undefined
      ? semester === 1 || semester === "1"
        ? "1ST"
        : "2ND"
      : semesterRecord.semester;

  const academicYearValue =
    academic_year !== undefined ? academic_year : semesterRecord.academic_year;

  // Check if the combination already exists (only if academic_year or semester is being changed)
  if (
    (academic_year && academic_year !== semesterRecord.academic_year) ||
    (semester && semesterValue !== semesterRecord.semester)
  ) {
    const existingSemester = await Semester.findOne({
      where: {
        academic_year: academicYearValue,
        semester: semesterValue,
        id: { [Op.ne]: id },
      },
    });

    if (existingSemester) {
      throw new ErrorClass(
        `Semester ${semesterValue} for academic year ${academicYearValue} already exists`,
        409
      );
    }
  }

  if (status === "active" && semesterRecord.status !== "active") {
    await Semester.update(
      { status: "closed" },
      {
        where: {
          status: "active",
          id: { [Op.ne]: id },
        },
      }
    );
  }

  // Build update object with formatted dates
  const updateData = {};

  if (academic_year !== undefined) updateData.academic_year = academic_year;
  if (semester !== undefined) updateData.semester = semesterValue;
  if (start_date) {
    const startDateObj = new Date(start_date);
    updateData.start_date = startDateObj.toISOString().split("T")[0]; // Store as string "YYYY-MM-DD"
  }
  if (end_date) {
    const endDateObj = new Date(end_date);
    updateData.end_date = endDateObj.toISOString().split("T")[0]; // Store as string "YYYY-MM-DD"
  }
  if (status !== undefined) updateData.status = status;

  // Use raw SQL for date fields to bypass Sequelize's type conversion
  // The database columns are VARCHAR, but Sequelize model defines them as DATE
  // This causes type conversion issues, so we use raw SQL for dates
  if (Object.keys(updateData).length > 0) {
    // If we have date fields, use raw SQL for those
    if (updateData.start_date || updateData.end_date) {
      const setClauses = [];
      const replacements = { id: parseInt(id) };

      if (updateData.start_date) {
        setClauses.push('"start_date" = :startDate');
        replacements.startDate = updateData.start_date;
      }
      if (updateData.end_date) {
        setClauses.push('"end_date" = :endDate');
        replacements.endDate = updateData.end_date;
      }

      await Semester.sequelize.query(
        `UPDATE "semester" SET ${setClauses.join(", ")} WHERE "id" = :id`,
        {
          replacements,
          type: Semester.sequelize.QueryTypes.UPDATE,
        }
      );

      // Remove date fields from updateData and use regular update for the rest
      delete updateData.start_date;
      delete updateData.end_date;
    }

    // Update non-date fields using regular Sequelize update
    if (Object.keys(updateData).length > 0) {
      await Semester.update(updateData, { where: { id } });
    }

    await semesterRecord.reload();
  }

  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "updated_semester", "semester", id, {
        changes: {
          before: oldData,
          after: {
            academic_year: semesterRecord.academic_year,
            semester: semesterRecord.semester,
            start_date: semesterRecord.start_date,
            end_date: semesterRecord.end_date,
            status: semesterRecord.status,
          },
        },
      });
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Semester updated successfully",
    data: {
      semester: semesterRecord,
    },
  });
});

export const closeSemester = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const semester = await Semester.findByPk(id);
  if (!semester) {
    throw new ErrorClass("Semester not found", 404);
  }

  if (semester.status === "closed") {
    throw new ErrorClass("Semester is already closed", 400);
  }

  semester.status = "closed";
  await semester.save();

  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "closed_semester", "semester", id, {
        academic_year: semester.academic_year,
        semester: semester.semester,
      });
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Semester closed successfully",
    data: {
      semester,
    },
  });
});

export const extendSemester = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { new_end_date, reason } = req.body || {};

  if (!new_end_date) {
    throw new ErrorClass("New end date is required", 400);
  }

  const semester = await Semester.findByPk(id);
  if (!semester) {
    throw new ErrorClass("Semester not found", 404);
  }

  const newEndDate = new Date(new_end_date);
  if (isNaN(newEndDate.getTime())) {
    throw new ErrorClass("Invalid date format", 400);
  }

  // Format date as YYYY-MM-DD string (database column is VARCHAR(15))
  const formattedEndDate = newEndDate.toISOString().split("T")[0];

  // Compare dates properly
  const currentEndDate = new Date(semester.end_date);
  const currentStartDate = new Date(semester.start_date);

  if (newEndDate <= currentStartDate) {
    throw new ErrorClass("New end date must be after start date", 400);
  }

  if (newEndDate <= currentEndDate) {
    throw new ErrorClass("New end date must be after current end date", 400);
  }

  const oldEndDate = semester.end_date;

  // Use raw SQL to bypass Sequelize's type conversion completely
  // The database column is VARCHAR(15), so we need to save as string
  // Sequelize.update() still tries to convert based on model definition (DataTypes.DATE)
  await Semester.sequelize.query(
    `UPDATE "semester" SET "end_date" = :endDate WHERE "id" = :id`,
    {
      replacements: { endDate: formattedEndDate, id: parseInt(id) },
      type: Semester.sequelize.QueryTypes.UPDATE,
    }
  );

  // Reload the semester to get the updated value
  await semester.reload();

  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "extended_semester", "semester", id, {
        academic_year: semester.academic_year,
        semester: semester.semester,
        old_end_date: oldEndDate,
        new_end_date: newEndDate,
        reason: reason || null,
      });
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Semester extended successfully",
    data: {
      semester,
      extension: {
        old_end_date: oldEndDate,
        new_end_date: newEndDate,
        days_extended: Math.ceil(
          (newEndDate - oldEndDate) / (1000 * 60 * 60 * 24)
        ),
      },
    },
  });
});

export const activateSemester = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const semester = await Semester.findByPk(id);
  if (!semester) {
    throw new ErrorClass("Semester not found", 404);
  }

  if (semester.status === "active") {
    throw new ErrorClass("Semester is already active", 400);
  }

  // Get the previous active semester to check if academic year changed
  const previousActiveSemester = await Semester.findOne({
    where: {
      status: "active",
      id: { [Op.ne]: id },
    },
    order: [["id", "DESC"]],
  });

  // Close all other active semesters
  await Semester.update(
    { status: "closed" },
    {
      where: {
        status: "active",
        id: { [Op.ne]: id },
      },
    }
  );

  // NOTE: Level progression is now handled per-student during course registration
  // This is more efficient and scalable than bulk operations
  // See: src/services/studentLevelProgressionService.js

  semester.status = "active";
  await semester.save();

  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "activated_semester",
        "semester",
        id,
        {
          academic_year: semester.academic_year,
          semester: semester.semester,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  // Automatically allocate courses when semester is activated
  let allocationResult = null;
  try {
    allocationResult = await allocateCoursesToAllStudents(
      semester.academic_year,
      semester.semester
    );
    console.log(
      `✅ Automatic course allocation completed: ${allocationResult.allocated} allocated, ${allocationResult.skipped} skipped`
    );
  } catch (allocationError) {
    console.error("Error during automatic course allocation:", allocationError);
    // Don't fail the semester activation if allocation fails
  }

  res.status(200).json({
    success: true,
    message: "Semester activated successfully",
    data: {
      semester,
      allocation: allocationResult
        ? {
            allocated: allocationResult.allocated,
            skipped: allocationResult.skipped,
            errors: allocationResult.errors?.length || 0,
          }
        : null,
    },
  });
});

/**
 * Extend registration deadline for a semester
 * PATCH /api/admin/semesters/:id/extend-deadline
 */
export const extendRegistrationDeadline = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { new_deadline, reason } = req.body || {};

  if (!new_deadline) {
    throw new ErrorClass("new_deadline is required", 400);
  }

  const semester = await Semester.findByPk(id);
  if (!semester) {
    throw new ErrorClass("Semester not found", 404);
  }

  // Validate deadline is a valid date
  const deadlineDate = new Date(new_deadline);
  if (isNaN(deadlineDate.getTime())) {
    throw new ErrorClass("Invalid deadline date format", 400);
  }

  // Format as YYYY-MM-DD for VARCHAR(15) column
  const formattedDeadline = deadlineDate.toISOString().split("T")[0];

  const oldDeadline = semester.registration_deadline;

  // Update using raw SQL to handle VARCHAR date field
  await Semester.sequelize.query(
    `UPDATE semester SET registration_deadline = :deadline WHERE id = :id`,
    {
      replacements: { deadline: formattedDeadline, id: parseInt(id) },
      type: Semester.sequelize.QueryTypes.UPDATE,
    }
  );

  await semester.reload();

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "extended_registration_deadline",
        "semester",
        id,
        {
          academic_year: semester.academic_year,
          semester: semester.semester,
          old_deadline: oldDeadline,
          new_deadline: formattedDeadline,
          reason: reason || null,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Registration deadline extended successfully",
    data: {
      semester: {
        id: semester.id,
        academic_year: semester.academic_year,
        semester: semester.semester,
        registration_deadline: semester.registration_deadline,
      },
      extension: {
        old_deadline: oldDeadline,
        new_deadline: formattedDeadline,
      },
    },
  });
});

export const deleteSemester = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const semester = await Semester.findByPk(id);
  if (!semester) {
    throw new ErrorClass("Semester not found", 404);
  }

  if (semester.status === "active") {
    throw new ErrorClass(
      "Cannot delete active semester. Please close it first.",
      400
    );
  }

  await semester.destroy();
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(req.user.id, "deleted_semester", "semester", id, {
        academic_year: semester.academic_year,
        semester: semester.semester,
      });
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Semester deleted successfully",
  });
});

export const getSemesterStats = TryCatchFunction(async (req, res) => {
  const totalSemesters = await Semester.count();
  const activeSemesters = await Semester.count({
    where: Semester.sequelize.where(
      Semester.sequelize.fn("UPPER", Semester.sequelize.col("status")),
      "ACTIVE"
    ),
  });
  const closedSemesters = await Semester.count({
    where: Semester.sequelize.where(
      Semester.sequelize.fn("UPPER", Semester.sequelize.col("status")),
      "CLOSED"
    ),
  });
  ("CLOSED");

  const pendingSemesters = await Semester.count({
    where: { status: "pending" },
  });

  const currentDate = new Date();
  const today = currentDate.toISOString().split("T")[0];

  let semester = await Semester.findOne({
    where: {
      [Op.and]: [
        Semester.sequelize.literal(`DATE(start_date) <= '${today}'`),
        Semester.sequelize.literal(`DATE(end_date) >= '${today}'`),
      ],
    },
    order: [["id", "DESC"]],
  });

  if (!semester) {
    semester = await Semester.findOne({
      where: Semester.sequelize.where(
        Semester.sequelize.fn("UPPER", Semester.sequelize.col("status")),
        "ACTIVE"
      ),
      order: [["id", "DESC"]],
    });
  }

  if (!semester) {
    semester = await Semester.findOne({
      order: [["id", "DESC"]],
    });
  }

  res.status(200).json({
    success: true,
    message: "Semester statistics retrieved successfully",
    data: {
      total: totalSemesters,
      active: activeSemesters,
      closed: closedSemesters,
      pending: pendingSemesters,
      current: semester,
    },
  });
});
