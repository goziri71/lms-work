import { Courses } from "../models/course/courses.js";
import { Staff } from "../models/auth/staff.js";
import { Students } from "../models/auth/student.js";

export async function fetchStudentCourses({
  studentId,
  academicYear,
  semester,
}) {
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

  const student = await Students.findByPk(studentId, {
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

  return student?.courses || [];
}

export async function fetchStaffCourses({
  staffId,
  academicYear,
  semester,
  includeStudents = false,
}) {
  const courseWhere = { staff_id: staffId, ...(semester ? { semester } : {}) };

  const include = [];
  if (includeStudents) {
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

  const courses = await Courses.findAll({
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

  return courses;
}
