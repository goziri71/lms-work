// associations/index.js
import { Students } from "./auth/student.js";
import { Staff } from "./auth/staff.js";
import { Courses } from "./course/courses.js";
import { CourseReg } from "./course_reg.js";
import { Semester } from "./auth/semester.js";
import { Modules } from "./modules/modules.js";
import { Units } from "./modules/units.js";
import { Quiz } from "./modules/quiz.js";
import { QuizQuestions } from "./modules/quiz_questions.js";
import { QuizOptions } from "./modules/quiz_options.js";
import { QuizAttempts } from "./modules/quiz_attempts.js";
import { QuizAnswers } from "./modules/quiz_answers.js";
import { EmailLog } from "./email/emailLog.js";
import { EmailPreference } from "./email/emailPreference.js";
import { Program } from "./program/program.js";
import { WspAdmin } from "./admin/wspAdmin.js";
import { AdminActivityLog } from "./admin/adminActivityLog.js";
// Import other models like Faculty when you have them

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

  // Student-Course registrations via junction table `course_reg`
  Students.belongsToMany(Courses, {
    through: CourseReg,
    as: "courses",
    foreignKey: "student_id",
    otherKey: "course_id",
  });
  Courses.belongsToMany(Students, {
    through: CourseReg,
    as: "students",
    foreignKey: "course_id",
    otherKey: "student_id",
  });

  // Direct associations to CourseReg for querying registration details
  Students.hasMany(CourseReg, {
    foreignKey: "student_id",
    as: "courseRegistrations",
  });
  CourseReg.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });
  CourseReg.belongsTo(Courses, {
    foreignKey: "course_id",
    as: "course",
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

  // Modules -> Courses association (for quiz queries)
  Modules.belongsTo(Courses, {
    foreignKey: "course_id",
    as: "course",
  });
  Courses.hasMany(Modules, {
    foreignKey: "course_id",
    as: "modules",
  });

  // Quiz associations - Modules -> Quiz (One-to-Many)
  Modules.hasMany(Quiz, {
    foreignKey: "module_id",
    as: "quizzes",
    onDelete: "CASCADE",
  });
  Quiz.belongsTo(Modules, {
    foreignKey: "module_id",
    as: "module",
  });

  // Quiz -> QuizQuestions (One-to-Many)
  Quiz.hasMany(QuizQuestions, {
    foreignKey: "quiz_id",
    as: "questions",
    onDelete: "CASCADE",
  });
  QuizQuestions.belongsTo(Quiz, {
    foreignKey: "quiz_id",
    as: "quiz",
  });

  // QuizQuestions -> QuizOptions (One-to-Many)
  QuizQuestions.hasMany(QuizOptions, {
    foreignKey: "question_id",
    as: "options",
    onDelete: "CASCADE",
  });

  QuizOptions.belongsTo(QuizQuestions, {
    foreignKey: "question_id",
    as: "question",
  });

  // Quiz -> QuizAttempts (One-to-Many)
  Quiz.hasMany(QuizAttempts, {
    foreignKey: "quiz_id",
    as: "attempts",
    onDelete: "CASCADE",
  });
  QuizAttempts.belongsTo(Quiz, {
    foreignKey: "quiz_id",
    as: "quiz",
  });

  // QuizAttempts -> QuizAnswers (One-to-Many)
  QuizAttempts.hasMany(QuizAnswers, {
    foreignKey: "attempt_id",
    as: "answers",
    onDelete: "CASCADE",
  });
  QuizAnswers.belongsTo(QuizAttempts, {
    foreignKey: "attempt_id",
    as: "attempt",
  });

  // Email associations
  // Students -> EmailLogs (One-to-Many)
  Students.hasMany(EmailLog, {
    foreignKey: "user_id",
    constraints: false,
    scope: {
      user_type: "student",
    },
    as: "emailLogs",
  });

  // Staff -> EmailLogs (One-to-Many)
  Staff.hasMany(EmailLog, {
    foreignKey: "user_id",
    constraints: false,
    scope: {
      user_type: "staff",
    },
    as: "emailLogs",
  });

  // Students -> EmailPreference (One-to-One)
  Students.hasOne(EmailPreference, {
    foreignKey: "user_id",
    constraints: false,
    scope: {
      user_type: "student",
    },
    as: "emailPreference",
  });

  // Staff -> EmailPreference (One-to-One)
  Staff.hasOne(EmailPreference, {
    foreignKey: "user_id",
    constraints: false,
    scope: {
      user_type: "staff",
    },
    as: "emailPreference",
  });

  // Program associations
  // Program -> Students (One-to-Many)
  Program.hasMany(Students, {
    foreignKey: "program_id",
    as: "students",
  });

  // Students -> Program (Many-to-One)
  Students.belongsTo(Program, {
    foreignKey: "program_id",
    as: "program",
  });

  // Note: Program -> Faculty association will be added when Faculty model is available
  // Program.belongsTo(Faculty, { foreignKey: "faculty_id", as: "faculty" });

  // Admin associations
  // WspAdmin -> AdminActivityLog (One-to-Many)
  WspAdmin.hasMany(AdminActivityLog, {
    foreignKey: "admin_id",
    as: "activityLogs",
  });

  AdminActivityLog.belongsTo(WspAdmin, {
    foreignKey: "admin_id",
    as: "admin",
  });
};
