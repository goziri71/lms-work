import { Op } from "sequelize";
import { Students } from "../../../models/auth/student.js";
import { Courses } from "../../../models/course/courses.js";
import { CourseReg } from "../../../models/course_reg.js";
import { Program } from "../../../models/program/program.js";
import { Semester } from "../../../models/auth/semester.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";
import { CourseSemesterPricing } from "../../../models/course/courseSemesterPricing.js";

// Helper function to get course price for semester
const getCoursePriceForSemester = async (courseId, academicYear, semester) => {
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

/**
 * Allocate courses to students
 * POST /api/admin/courses/allocate
 */
export const allocateCourses = TryCatchFunction(async (req, res) => {
  const {
    allocation_type,
    course_ids,
    academic_year,
    semester,
    program_id,
    level,
    student_ids,
    faculty_id,
    exclude_student_ids,
  } = req.body || {};

  // Validate required fields
  if (!allocation_type || !course_ids || !Array.isArray(course_ids) || course_ids.length === 0) {
    throw new ErrorClass(
      "allocation_type and course_ids array are required",
      400
    );
  }

  if (!academic_year || !semester) {
    throw new ErrorClass("academic_year and semester are required", 400);
  }

  // Validate allocation type
  const validTypes = ["program", "level", "individual", "faculty"];
  if (!validTypes.includes(allocation_type)) {
    throw new ErrorClass(
      `allocation_type must be one of: ${validTypes.join(", ")}`,
      400
    );
  }

  // Validate courses exist and are WPU courses
  const courses = await Courses.findAll({
    where: {
      id: { [Op.in]: course_ids },
      owner_type: { [Op.in]: ["wpu", "wsp"] }, // Only WPU courses
    },
  });

  if (courses.length !== course_ids.length) {
    const foundIds = courses.map((c) => c.id);
    const missingIds = course_ids.filter((id) => !foundIds.includes(id));
    throw new ErrorClass(
      `Some courses not found or not WPU courses: ${missingIds.join(", ")}`,
      404
    );
  }

  // Get students based on allocation type
  let students = [];
  const studentWhere = {
    admin_status: "active", // Only active students
  };

  if (allocation_type === "program") {
    if (!program_id) {
      throw new ErrorClass("program_id is required for program allocation", 400);
    }
    studentWhere.program_id = program_id;
    if (level) {
      studentWhere.level = level.toString();
    }
  } else if (allocation_type === "level") {
    if (!level) {
      throw new ErrorClass("level is required for level allocation", 400);
    }
    studentWhere.level = level.toString();
  } else if (allocation_type === "individual") {
    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      throw new ErrorClass(
        "student_ids array is required for individual allocation",
        400
      );
    }
    studentWhere.id = { [Op.in]: student_ids };
  } else if (allocation_type === "faculty") {
    if (!faculty_id) {
      throw new ErrorClass("faculty_id is required for faculty allocation", 400);
    }
    // Get all programs in this faculty
    const programs = await Program.findAll({
      where: { faculty_id },
      attributes: ["id"],
    });
    const programIds = programs.map((p) => p.id);
    if (programIds.length === 0) {
      throw new ErrorClass("No programs found in this faculty", 404);
    }
    studentWhere.program_id = { [Op.in]: programIds };
    if (level) {
      studentWhere.level = level.toString();
    }
  }

  // Exclude specific students if provided
  if (exclude_student_ids && Array.isArray(exclude_student_ids) && exclude_student_ids.length > 0) {
    studentWhere.id = {
      ...(studentWhere.id || {}),
      [Op.notIn]: exclude_student_ids,
    };
  }

  students = await Students.findAll({
    where: studentWhere,
    attributes: ["id", "program_id", "facaulty_id", "level", "fname", "lname", "email"],
  });

  if (students.length === 0) {
    throw new ErrorClass("No students found matching the criteria", 404);
  }

  // Validate courses match student programs (for program/faculty allocation)
  if (allocation_type === "program" || allocation_type === "faculty") {
    const studentProgramIds = [...new Set(students.map((s) => s.program_id).filter(Boolean))];
    const invalidCourses = courses.filter(
      (c) => c.program_id && !studentProgramIds.includes(c.program_id)
    );
    if (invalidCourses.length > 0) {
      throw new ErrorClass(
        `Some courses don't match student programs: ${invalidCourses.map((c) => c.course_code).join(", ")}`,
        400
      );
    }
  }

  // Get current semester to check registration deadline
  const currentSemester = await Semester.findOne({
    where: {
      academic_year: academic_year.toString(),
      semester: semester.toString(),
    },
  });

  if (!currentSemester) {
    throw new ErrorClass("Semester not found", 404);
  }

  // Allocate courses to students
  const results = {
    allocated: 0,
    skipped: 0,
    errors: [],
  };

  const allocationDate = new Date();

  for (const student of students) {
    for (const course of courses) {
      try {
        // Check if already allocated/registered
        const existing = await CourseReg.findOne({
          where: {
            student_id: student.id,
            course_id: course.id,
            academic_year: academic_year.toString(),
            semester: semester.toString(),
          },
        });

        if (existing) {
          // Update existing if it's just allocated (not registered yet)
          if (existing.registration_status === "allocated") {
            // Update price if it changed
            const currentPrice = await getCoursePriceForSemester(
              course.id,
              academic_year,
              semester
            );
            await existing.update({
              allocated_price: currentPrice,
            });
            results.skipped++;
          } else {
            results.skipped++;
          }
          continue;
        }

        // Get price for this course in this semester
        const price = await getCoursePriceForSemester(
          course.id,
          academic_year,
          semester
        );

        // Create allocation (CourseReg with status "allocated")
        await CourseReg.create({
          student_id: student.id,
          course_id: course.id,
          academic_year: academic_year.toString(),
          semester: semester.toString(),
          program_id: student.program_id,
          facaulty_id: student.facaulty_id,
          level: student.level,
          registration_status: "allocated",
          allocated_price: price,
          allocated_at: allocationDate,
          first_ca: 0,
          second_ca: 0,
          third_ca: 0,
          exam_score: 0,
          date: allocationDate.toISOString().split("T")[0],
        });

        results.allocated++;
      } catch (error) {
        results.errors.push({
          student_id: student.id,
          course_id: course.id,
          error: error.message,
        });
      }
    }
  }

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "allocated_courses",
        "course",
        null,
        {
          allocation_type,
          course_ids,
          academic_year: academic_year.toString(),
          semester: semester.toString(),
          program_id: program_id || null,
          level: level || null,
          faculty_id: faculty_id || null,
          student_count: students.length,
          allocated: results.allocated,
          skipped: results.skipped,
          errors: results.errors.length,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: `Courses allocated: ${results.allocated} allocations created, ${results.skipped} skipped`,
    data: {
      summary: {
        students_count: students.length,
        courses_count: courses.length,
        total_possible: students.length * courses.length,
        allocated: results.allocated,
        skipped: results.skipped,
        errors: results.errors.length,
      },
      errors: results.errors.length > 0 ? results.errors : undefined,
    },
  });
});

/**
 * Get allocated courses for students
 * GET /api/admin/courses/allocations
 */
export const getAllocatedCourses = TryCatchFunction(async (req, res) => {
  const {
    academic_year,
    semester,
    student_id,
    program_id,
    level,
    registration_status,
    page = 1,
    limit = 20,
  } = req.query;

  const where = {};
  if (academic_year) where.academic_year = academic_year.toString();
  if (semester) where.semester = semester.toString();
  if (student_id) where.student_id = parseInt(student_id);
  if (program_id) where.program_id = parseInt(program_id);
  if (level) where.level = level.toString();
  if (registration_status) where.registration_status = registration_status;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: allocations } = await CourseReg.findAndCountAll({
    where,
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "email", "matric_number", "level"],
      },
      {
        model: Courses,
        as: "course",
        attributes: [
          "id",
          "title",
          "course_code",
          "course_unit",
          "program_id",
          "faculty_id",
        ],
      },
    ],
    order: [
      ["academic_year", "DESC"],
      ["semester", "DESC"],
      ["student_id", "ASC"],
      [{ model: Courses, as: "course" }, "course_code", "ASC"],
    ],
    limit: parseInt(limit),
    offset,
  });

  res.status(200).json({
    success: true,
    message: "Allocated courses retrieved successfully",
    data: {
      allocations: allocations.map((a) => ({
        id: a.id,
        student: {
          id: a.student?.id,
          name: `${a.student?.fname || ""} ${a.student?.lname || ""}`.trim(),
          email: a.student?.email,
          matric_number: a.student?.matric_number,
          level: a.student?.level,
        },
        course: {
          id: a.course?.id,
          title: a.course?.title,
          course_code: a.course?.course_code,
          course_unit: a.course?.course_unit,
        },
        academic_year: a.academic_year,
        semester: a.semester,
        registration_status: a.registration_status,
        allocated_price: a.allocated_price ? parseFloat(a.allocated_price) : null,
        allocated_at: a.allocated_at,
        registered_at: a.registered_at,
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
 * Remove course allocation
 * DELETE /api/admin/courses/allocate/:id
 */
export const removeAllocation = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const allocation = await CourseReg.findByPk(id, {
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname"],
      },
      {
        model: Courses,
        as: "course",
        attributes: ["id", "title", "course_code"],
      },
    ],
  });

  if (!allocation) {
    throw new ErrorClass("Allocation not found", 404);
  }

  // Only allow removal if not yet registered
  if (allocation.registration_status === "registered") {
    throw new ErrorClass(
      "Cannot remove allocation that is already registered. Student must unregister first.",
      400
    );
  }

  await allocation.destroy();

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "removed_course_allocation",
        "course",
        allocation.course_id,
        {
          student_id: allocation.student_id,
          student_name: `${allocation.student?.fname} ${allocation.student?.lname}`,
          course_code: allocation.course?.course_code,
          academic_year: allocation.academic_year,
          semester: allocation.semester,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: "Course allocation removed successfully",
  });
});

/**
 * Bulk remove allocations
 * DELETE /api/admin/courses/allocate/bulk
 */
export const bulkRemoveAllocations = TryCatchFunction(async (req, res) => {
  const { student_ids, course_ids, academic_year, semester } = req.body || {};

  if (!academic_year || !semester) {
    throw new ErrorClass("academic_year and semester are required", 400);
  }

  const where = {
    academic_year: academic_year.toString(),
    semester: semester.toString(),
    registration_status: "allocated", // Only remove unregistered allocations
  };

  if (student_ids && Array.isArray(student_ids) && student_ids.length > 0) {
    where.student_id = { [Op.in]: student_ids };
  }

  if (course_ids && Array.isArray(course_ids) && course_ids.length > 0) {
    where.course_id = { [Op.in]: course_ids };
  }

  const deletedCount = await CourseReg.destroy({ where });

  // Log activity
  try {
    if (req.user && req.user.id) {
      await logAdminActivity(
        req.user.id,
        "bulk_removed_allocations",
        "course",
        null,
        {
          academic_year: academic_year.toString(),
          semester: semester.toString(),
          deleted_count: deletedCount,
          student_ids: student_ids || null,
          course_ids: course_ids || null,
        }
      );
    }
  } catch (logError) {
    console.error("Error logging admin activity:", logError);
  }

  res.status(200).json({
    success: true,
    message: `${deletedCount} allocations removed successfully`,
    data: {
      deleted_count: deletedCount,
    },
  });
});

