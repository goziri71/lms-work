import { Students } from "../../../models/auth/student.js";
import { Staff } from "../../../models/auth/staff.js";
import { WspAdmin } from "../../../models/admin/wspAdmin.js";
import { Courses } from "../../../models/course/courses.js";
import { Program } from "../../../models/program/program.js";
import { Faculty } from "../../../models/faculty/faculty.js";
import { Semester } from "../../../models/auth/semester.js";
import { CourseReg } from "../../../models/course_reg.js";
import { Funding } from "../../../models/payment/funding.js";
import { SchoolFees } from "../../../models/payment/schoolFees.js";
import { db } from "../../../database/database.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";

/**
 * Get dashboard statistics
 */
export const getDashboardStats = TryCatchFunction(async (req, res) => {
  // Get staff counts first (handle missing admin_status column)
  const totalStaff = await Staff.count();
  let activeStaff = totalStaff; // Default: all staff are active if column doesn't exist
  try {
    activeStaff = await Staff.count({ where: { admin_status: "active" } });
  } catch (error) {
    // If admin_status column doesn't exist, use total count
    console.warn("admin_status column not found in staff table, using total count");
  }

  // Get all other counts in parallel
  const [
    totalStudents,
    activeStudents,
    inactiveStudents,
    totalAdmins,
    totalPrograms,
    activePrograms,
    totalCourses,
    totalFaculties,
    currentSemester,
    totalEnrollments,
    recentFundings,
    recentSchoolFees,
  ] = await Promise.all([
    // Students
    Students.count(),
    Students.count({ where: { admin_status: "active" } }),
    Students.count({ where: { admin_status: "inactive" } }),

    // Admins
    WspAdmin.count({ where: { status: "active" } }),

    // Programs
    Program.count(),
    Program.count({ where: { status: "Y" } }),

    // Courses
    Courses.count(),

    // Faculties
    Faculty.count(),

    // Current Semester
    Semester.findOne({
      where: { status: "active" },
      order: [["academic_year", "DESC"], ["semester", "DESC"]],
    }),

    // Enrollments
    CourseReg.count(),

    // Recent transactions (last 30 days)
    Funding.count({
      where: {
        date: {
          [db.Sequelize.Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),

    SchoolFees.count({
      where: {
        date: {
          [db.Sequelize.Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  // Get students by level
  const studentsByLevel = await Students.findAll({
    attributes: [
      "level",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("Student.id")), "count"],
    ],
    group: ["level"],
    order: [["level", "ASC"]],
    raw: true,
  });

  // Get students by program
  const studentsByProgram = await Students.findAll({
    attributes: [
      "program_id",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("Student.id")), "count"],
    ],
    include: [
      {
        model: Program,
        as: "program",
        attributes: ["title"],
        required: false,
      },
    ],
    group: ["program_id", "program.id"],
    order: [[db.Sequelize.literal("count"), "DESC"]],
    limit: 5,
  });

  // Get recent activity (last 7 days enrollments)
  const recentEnrollments = await CourseReg.count({
    where: {
      date: {
        [db.Sequelize.Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  res.status(200).json({
    success: true,
    message: "Dashboard statistics retrieved successfully",
    data: {
      overview: {
        students: {
          total: totalStudents,
          active: activeStudents,
          inactive: inactiveStudents,
        },
        staff: {
          total: totalStaff,
          active: activeStaff,
        },
        admins: {
          total: totalAdmins,
        },
        academic: {
          programs: {
            total: totalPrograms,
            active: activePrograms,
          },
          courses: totalCourses,
          faculties: totalFaculties,
        },
        enrollments: totalEnrollments,
      },
      currentSemester: currentSemester
        ? {
            id: currentSemester.id,
            academic_year: currentSemester.academic_year,
            semester: currentSemester.semester,
            start_date: currentSemester.start_date,
            end_date: currentSemester.end_date,
            status: currentSemester.status,
          }
        : null,
      studentsByLevel: studentsByLevel,
      topPrograms: studentsByProgram.map((item) => ({
        program_id: item.program_id,
        program_title: item.program?.title || "Unknown",
        student_count: parseInt(item.dataValues.count || 0),
      })),
      recentActivity: {
        enrollmentsLast7Days: recentEnrollments,
        fundingsLast30Days: recentFundings,
        schoolFeesLast30Days: recentSchoolFees,
      },
    },
  });
});

