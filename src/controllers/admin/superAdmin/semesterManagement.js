import { Op } from "sequelize";
import { Semester } from "../../../models/auth/semester.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";

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
  } = req.body;

  if (!academic_year || !semester || !start_date || !end_date) {
    throw new ErrorClass(
      "Academic year, semester, start date, and end date are required",
      400
    );
  }

  if (semester !== 1 && semester !== 2) {
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

  const existingSemester = await Semester.findOne({
    where: {
      academic_year: parseInt(academic_year),
      semester: parseInt(semester),
    },
  });

  if (existingSemester) {
    throw new ErrorClass(
      `Semester ${semester} for academic year ${academic_year} already exists`,
      409
    );
  }

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

  const newSemester = await Semester.create({
    academic_year: parseInt(academic_year),
    semester: parseInt(semester),
    start_date: startDate,
    end_date: endDate,
    status: status,
    date: new Date(),
  });

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

  res.status(201).json({
    success: true,
    message: "Semester created successfully",
    data: {
      semester: newSemester,
    },
  });
});

export const updateSemester = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { academic_year, semester, start_date, end_date, status } = req.body;

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

  if (
    (academic_year && academic_year !== semesterRecord.academic_year) ||
    (semester && semester !== semesterRecord.semester)
  ) {
    const existingSemester = await Semester.findOne({
      where: {
        academic_year: academic_year || semesterRecord.academic_year,
        semester: semester || semesterRecord.semester,
        id: { [Semester.sequelize.Op.ne]: id },
      },
    });

    if (existingSemester) {
      throw new ErrorClass(
        `Semester ${semester || semesterRecord.semester} for academic year ${
          academic_year || semesterRecord.academic_year
        } already exists`,
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
          id: { [Semester.sequelize.Op.ne]: id },
        },
      }
    );
  }

  if (academic_year !== undefined)
    semesterRecord.academic_year = parseInt(academic_year);
  if (semester !== undefined) semesterRecord.semester = parseInt(semester);
  if (start_date) semesterRecord.start_date = new Date(start_date);
  if (end_date) semesterRecord.end_date = new Date(end_date);
  if (status !== undefined) semesterRecord.status = status;

  await semesterRecord.save();

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
  const { new_end_date, reason } = req.body;

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

  if (newEndDate <= semester.start_date) {
    throw new ErrorClass("New end date must be after start date", 400);
  }

  if (newEndDate <= semester.end_date) {
    throw new ErrorClass("New end date must be after current end date", 400);
  }

  const oldEndDate = semester.end_date;
  semester.end_date = newEndDate;
  await semester.save();

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

  await Semester.update(
    { status: "closed" },
    {
      where: {
        status: "active",
        id: { [Semester.sequelize.Op.ne]: id },
      },
    }
  );

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

  res.status(200).json({
    success: true,
    message: "Semester activated successfully",
    data: {
      semester,
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
