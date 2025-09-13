import { Students } from "../models/auth/student.js";
import { Courses } from "../models/course/courses.js";

const checkEnrollment = async () => {
  try {
    console.log("Checking student enrollment...");

    // Check if student exists
    const student = await Students.findByPk(1);
    console.log("Student found:", student?.toJSON());

    // Check course_reg table directly
    const enrollment = await Students.findOne({
      where: { id: 1 },
      include: [
        {
          model: Courses,
          as: "courses",
          through: { attributes: [] },
        },
      ],
    });

    console.log(
      "Student enrollment:",
      enrollment?.courses?.map((c) => ({ id: c.id, title: c.title }))
    );
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(0);
  }
};

checkEnrollment();
