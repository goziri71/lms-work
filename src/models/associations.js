// associations/index.js
import { Students } from "./auth/student.js";
import { Staff } from "./auth/staff.js";
import { Courses } from "./course/courses.js";
import { Semester } from "./auth/semester.js";
import { Modules } from "./modules/modules.js";
import { Units } from "./modules/units.js";
// Import other models like Faculty, Program when you have them

export const setupAssociations = () => {
  // Staff teaches Courses
  Staff.hasMany(Courses, {
    foreignKey: "staff_id",
    as: "courses",
  });
  Courses.belongsTo(Staff, {
    foreignKey: "staff_id",
    as: "instructor",
  });

  // Students belong to Faculty (assuming you have Faculty model)
  // Students.belongsTo(Faculty, { foreignKey: 'faculty_id' });
  // Faculty.hasMany(Students, { foreignKey: 'faculty_id' });

  // Students belong to Program (assuming you have Program model)
  // Students.belongsTo(Program, { foreignKey: 'program_id' });
  // Program.hasMany(Students, { foreignKey: 'program_id' });

  // Courses belong to Faculty
  // Courses.belongsTo(Faculty, { foreignKey: 'faculty_id' });
  // Faculty.hasMany(Courses, { foreignKey: 'faculty_id' });

  // Student-Course enrollment (Many-to-Many)
  // You'll need to create an Enrollment junction table for this

  // Student-Course registrations via junction table `course_reg`
  Students.belongsToMany(Courses, {
    through: "course_reg",
    as: "courses",
    foreignKey: "student_id",
    otherKey: "course_id",
  });
  Courses.belongsToMany(Students, {
    through: "course_reg",
    as: "students",
    foreignKey: "course_id",
    otherKey: "student_id",
  });

  // Library DB associations (Modules -> Units)
  // Note: These are on a separate connection (dbLibrary) and do not join to LMS models.
  Modules.hasMany(Units, {
    foreignKey: "module_id",
    as: "units",
    onDelete: "CASCADE",
    hooks: true,
  });
  Units.belongsTo(Modules, {
    foreignKey: "module_id",
    as: "module",
  });
};
