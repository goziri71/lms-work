// associations/index.js
import { Students } from "../models/auth/student.js";
import { Staff } from "../models/auth/staff.js";
import { Courses } from "../models/auth/courses.js";
import { Semester } from "../models/auth/semester.js";
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
};
