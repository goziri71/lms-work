import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { Semester } from "../../models/auth/semester.js";

/**
 * STUDENT REGISTER FOR COURSE
 * POST /api/courses/register
 */
export const registerCourse = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can register for courses", 403);
  }

  const { course_id, academic_year, semester, level } = req.body;

  // Validate required fields
  if (!course_id || !academic_year || !semester) {
    throw new ErrorClass(
      "course_id, academic_year, and semester are required",
      400
    );
  }

  // Verify student exists
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Verify course exists
  const course = await Courses.findByPk(course_id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  // IMPORTANT: WPU students get FREE access to WPU courses
  // Marketplace courses (sole_tutor/organization) require payment via purchase endpoint
  if (course.is_marketplace && course.owner_type !== "wpu" && course.owner_type !== "wsp") {
    throw new ErrorClass(
      "This is a marketplace course and requires purchase. Please use the purchase endpoint: POST /api/marketplace/courses/purchase",
      400
    );
  }

  // Check if already registered
  const existingReg = await CourseReg.findOne({
    where: {
      student_id: studentId,
      course_id: course_id,
      academic_year: academic_year,
      semester: semester,
    },
  });

  if (existingReg) {
    throw new ErrorClass(
      "You are already registered for this course in this session",
      400
    );
  }

  // Create registration
  const registration = await CourseReg.create({
    student_id: studentId,
    course_id: course_id,
    academic_year: academic_year,
    semester: semester,
    level: level || student.level || "100",
    first_ca: 0,
    second_ca: 0,
    third_ca: 0,
    exam_score: 0,
    date: new Date().toISOString().split("T")[0],
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "Course registered successfully (Free - WPU Course)",
    data: {
      id: registration.id,
      course_id: registration.course_id,
      academic_year: registration.academic_year,
      semester: registration.semester,
      course_title: course.title,
      course_code: course.course_code,
      is_marketplace: course.is_marketplace,
      owner_type: course.owner_type,
      note: (course.owner_type === "wpu" || course.owner_type === "wsp")
        ? "This is a free WPU course" 
        : "Course registered",
    },
  });
});

/**
 * STUDENT UNREGISTER FROM COURSE
 * DELETE /api/courses/register/:registrationId
 */
export const unregisterCourse = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;
  const registrationId = Number(req.params.registrationId);

  if (userType !== "student") {
    throw new ErrorClass("Only students can unregister from courses", 403);
  }

  const registration = await CourseReg.findByPk(registrationId);

  if (!registration) {
    throw new ErrorClass("Registration not found", 404);
  }

  // Verify student owns this registration
  if (registration.student_id !== studentId) {
    throw new ErrorClass("Access denied", 403);
  }

  await registration.destroy();

  res.status(200).json({
    status: true,
    code: 200,
    message: "Course unregistered successfully",
  });
});

/**
 * GET AVAILABLE SEMESTERS
 * GET /api/courses/semesters
 */
export const getAvailableSemesters = TryCatchFunction(async (req, res) => {
  const semesters = await Semester.findAll({
    attributes: [
      "id",
      "academic_year",
      "semester",
      "status",
      "start_date",
      "end_date",
    ],
    order: [["start_date", "DESC"]],
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Semesters retrieved successfully",
    data: semesters,
  });
});

/**
 * GET ALL AVAILABLE COURSES FOR REGISTRATION
 * GET /api/courses/available
 */
export const getAvailableCourses = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  const { level, program_id, faculty_id } = req.query;

  const where = {};
  if (level) where.course_level = Number(level);

  const courses = await Courses.findAll({
    where: {
      ...where,
      // WPU students can see both WPU courses (free) and marketplace courses (paid)
      // Filter can be added later if needed
    },
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
      "staff_id",
      "owner_type",
      "is_marketplace",
      "marketplace_status",
    ],
    order: [["course_code", "ASC"]],
  });

  // Add pricing info for frontend
  const coursesWithPricing = courses.map((course) => {
    const courseData = course.toJSON();
    if (course.owner_type === "wpu" || course.owner_type === "wsp") {
      courseData.price = 0; // Free for WPU students
      courseData.requires_purchase = false;
    } else if (course.is_marketplace) {
      courseData.requires_purchase = true;
      courseData.purchase_endpoint = "/api/marketplace/courses/purchase";
    } else {
      courseData.requires_purchase = false;
    }
    return courseData;
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Available courses retrieved successfully",
    data: coursesWithPricing,
    note: "WPU courses are free. Marketplace courses require purchase.",
  });
});
