import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { Staff } from "../../models/auth/staff.js";
import { Courses } from "../../models/course/courses.js";

export const getStudentCourses = TryCatchFunction(async (req, res) => {
  // Accept either /student/:startYear/:endYear/:semester or query params
  const academicYear =
    req.query.academicYear ||
    (req.params.startYear && req.params.endYear
      ? `${req.params.startYear}/${req.params.endYear}`
      : req.params.academicYear);
  const semester = req.query.semester || req.params.semester;
  const parsedStudentId = Number(req.user?.id ?? req.user);
  if (!Number.isInteger(parsedStudentId) || parsedStudentId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }

  const student = await Students.findByPk(parsedStudentId, {
    attributes: ["id"],
  });
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  const includeCourses = {
    model: Courses,
    as: "courses",
    include: [
      {
        model: Staff,
        as: "instructor",
        attributes: ["id", "full_name", "email", "phone"],
      },
    ],
    attributes: [
      "id",
      "title",
      "course_code",
      "course_unit",
      "course_type",
      "course_level",
      "semester",
      "price",
      "exam_fee",
      "currency",
    ],
    through: {
      as: "registration",
      attributes: [
        "id",
        "academic_year",
        "semester",
        "level",
        "first_ca",
        "second_ca",
        "third_ca",
        "exam_score",
        "date",
        "ref",
      ],
      where:
        academicYear || semester
          ? {
              ...(academicYear ? { academic_year: academicYear } : {}),
              ...(semester ? { semester } : {}),
            }
          : undefined,
    },
  };

  const studentWithCourses = await Students.findByPk(parsedStudentId, {
    include: [includeCourses],
    attributes: [
      "id",
      "fname",
      "mname",
      "lname",
      "email",
      "matric_number",
      "level",
    ],
  });
  const data = studentWithCourses?.courses || [];
  if (data.length === 0) {
    throw new ErrorClass("No courses found", 404);
  }
  res.status(200).json({
    status: true,
    code: 200,
    message: "Courses fetched successfully",
    data: data,
  });
});

export const getStaffCourses = TryCatchFunction(async (req, res) => {
  const academicYear =
    req.query.academicYear ||
    (req.params.startYear && req.params.endYear
      ? `${req.params.startYear}/${req.params.endYear}`
      : req.params.academicYear);
  const { semester, includeStudents } = req.query;
  const parsedStaffId = Number(req.user);
  if (!Number.isInteger(parsedStaffId) || parsedStaffId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }

  const staff = await Staff.findByPk(parsedStaffId, { attributes: ["id"] });
  if (!staff) {
    throw new ErrorClass("Staff not found", 404);
  }

  const courseWhere = {
    staff_id: parsedStaffId,
    ...(semester ? { semester } : {}),
  };

  const include = [];
  if (String(includeStudents).toLowerCase() === "true") {
    include.push({
      model: Students,
      as: "students",
      attributes: [
        "id",
        "fname",
        "mname",
        "lname",
        "email",
        "matric_number",
        "level",
        "program_id",
        "facaulty_id",
      ],
      through: {
        as: "registration",
        attributes: [
          "id",
          "academic_year",
          "semester",
          "level",
          "first_ca",
          "second_ca",
          "third_ca",
          "exam_score",
        ],
        where: academicYear ? { academic_year: academicYear } : undefined,
      },
      required: false,
    });
  }

  const data = await Courses.findAll({
    where: courseWhere,
    include,
    attributes: [
      "id",
      "title",
      "course_code",
      "course_unit",
      "course_type",
      "course_level",
      "semester",
      "price",
      "exam_fee",
      "currency",
      "staff_id",
    ],
    order: [["id", "ASC"]],
  });
  res.status(200).json({
    status: true,
    code: 200,
    message: "Courses fetched successfully",
    data: data,
  });
});
