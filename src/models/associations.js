// associations/index.js
import { Students } from "./auth/student.js";
import { Staff } from "./auth/staff.js";
import { Courses } from "./course/courses.js";
import { CourseSemesterPricing } from "./course/courseSemesterPricing.js";
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
import { Faculty } from "./faculty/faculty.js";
import {
  CourseOrder,
  Funding,
  PaymentSetup,
  SchoolFees,
  SchoolFeesConfiguration,
  PaymentTransaction,
} from "./payment/index.js";
import { GeneralSetup } from "./settings/generalSetup.js";
import { Notice } from "./notice/notice.js";
import { SchoolAttended } from "./auth/schoolAttended.js";
import { LegacyUser } from "./auth/legacyUser.js";
import { StudentDocumentApproval } from "./kyc/studentDocumentApproval.js";
import {
  SoleTutor,
  Organization,
  OrganizationUser,
  MarketplaceTransaction,
  WspCommission,
  EBooks,
  EBookPurchase,
  DigitalDownloads,
  DigitalDownloadPurchase,
  TutorSubscription,
  CoachingSession,
  CoachingParticipant,
  CoachingSessionPurchase,
  CoachingHoursBalance,
  CoachingHoursPurchase,
  CoachingSettings,
  TutorBankAccount,
  TutorPayout,
  CoachingSchedulingMessage,
  Community,
  CommunityMember,
  CommunitySubscription,
  CommunityPost,
  CommunityComment,
  CommunityReaction,
  CommunityFile,
  CommunityPurchase,
  CommunityAudioSession,
  TutorWalletTransaction,
  LearnerActivityLog,
  CourseProgress,
  LearnerLoginHistory,
  Membership,
  MembershipProduct,
  MembershipSubscription,
  MembershipPayment,
} from "./marketplace/index.js";

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

  // EmailLog -> Students (Many-to-One)
  EmailLog.belongsTo(Students, {
    foreignKey: "user_id",
    constraints: false,
    scope: {
      user_type: "student",
    },
    as: "student",
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

  // EmailLog -> Staff (Many-to-One)
  EmailLog.belongsTo(Staff, {
    foreignKey: "user_id",
    constraints: false,
    scope: {
      user_type: "staff",
    },
    as: "staff",
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

  // Faculty associations
  // Faculty -> Programs (One-to-Many)
  Faculty.hasMany(Program, {
    foreignKey: "faculty_id",
    as: "programs",
  });
  Program.belongsTo(Faculty, {
    foreignKey: "faculty_id",
    as: "faculty",
  });

  // Program -> Courses (One-to-Many)
  Program.hasMany(Courses, {
    foreignKey: "program_id",
    as: "courses",
  });
  Courses.belongsTo(Program, {
    foreignKey: "program_id",
    as: "program",
  });

  // Courses -> Faculty (Many-to-One)
  Courses.belongsTo(Faculty, {
    foreignKey: "faculty_id",
    as: "faculty",
  });
  Faculty.hasMany(Courses, {
    foreignKey: "faculty_id",
    as: "courses",
  });

  // Course Semester Pricing associations
  // Courses -> CourseSemesterPricing (One-to-Many)
  Courses.hasMany(CourseSemesterPricing, {
    foreignKey: "course_id",
    as: "semesterPricing",
  });
  CourseSemesterPricing.belongsTo(Courses, {
    foreignKey: "course_id",
    as: "course",
  });

  // Payment associations
  // Students -> CourseOrder (One-to-Many)
  Students.hasMany(CourseOrder, {
    foreignKey: "student_id",
    as: "courseOrders",
  });
  CourseOrder.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // CourseReg -> CourseOrder (Many-to-One via course_reg_id)
  CourseReg.belongsTo(CourseOrder, {
    foreignKey: "course_reg_id",
    as: "courseOrder",
    constraints: false, // course_reg_id may be null
  });
  CourseOrder.hasMany(CourseReg, {
    foreignKey: "course_reg_id",
    as: "courseRegistrations",
  });

  // Students -> Funding (One-to-Many)
  Students.hasMany(Funding, {
    foreignKey: "student_id",
    as: "fundingTransactions",
  });
  Funding.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Students -> SchoolFees (One-to-Many)
  Students.hasMany(SchoolFees, {
    foreignKey: "student_id",
    as: "schoolFees",
  });
  SchoolFees.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Students -> PaymentTransaction (One-to-Many)
  Students.hasMany(PaymentTransaction, {
    foreignKey: "student_id",
    as: "paymentTransactions",
  });
  PaymentTransaction.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // School Fees Configuration associations
  // Program -> SchoolFeesConfiguration (One-to-Many)
  Program.hasMany(SchoolFeesConfiguration, {
    foreignKey: "program_id",
    as: "schoolFeesConfigurations",
  });
  SchoolFeesConfiguration.belongsTo(Program, {
    foreignKey: "program_id",
    as: "program",
  });

  // Faculty -> SchoolFeesConfiguration (One-to-Many)
  Faculty.hasMany(SchoolFeesConfiguration, {
    foreignKey: "faculty_id",
    as: "schoolFeesConfigurations",
  });
  SchoolFeesConfiguration.belongsTo(Faculty, {
    foreignKey: "faculty_id",
    as: "faculty",
  });

  // Students -> SchoolAttended (One-to-Many)
  Students.hasMany(SchoolAttended, {
    foreignKey: "student_id",
    as: "schoolsAttended",
  });
  SchoolAttended.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Students -> StudentDocumentApproval (One-to-Many)
  Students.hasMany(StudentDocumentApproval, {
    foreignKey: "student_id",
    as: "documentApprovals",
  });
  StudentDocumentApproval.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Notice -> Courses (Many-to-One, optional)
  Notice.belongsTo(Courses, {
    foreignKey: "course_id",
    as: "course",
  });
  Courses.hasMany(Notice, {
    foreignKey: "course_id",
    as: "notices",
  });

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

  // ============================================
  // MARKETPLACE ASSOCIATIONS
  // ============================================

  // Sole Tutor -> Courses (One-to-Many)
  SoleTutor.hasMany(Courses, {
    foreignKey: "owner_id",
    constraints: false,
    scope: { owner_type: "sole_tutor" },
    as: "courses",
  });

  // Organization -> Courses (One-to-Many)
  Organization.hasMany(Courses, {
    foreignKey: "owner_id",
    constraints: false,
    scope: { owner_type: "organization" },
    as: "courses",
  });

  // Organization -> Organization Users (One-to-Many)
  Organization.hasMany(OrganizationUser, {
    foreignKey: "organization_id",
    as: "users",
  });
  OrganizationUser.belongsTo(Organization, {
    foreignKey: "organization_id",
    as: "organization",
  });

  // Organization User -> Courses (via organization ownership)
  // Note: Courses are owned by organization, not individual org users
  // But org users can be assigned as instructors (staff_id)

  // Courses ownership (polymorphic)
  Courses.belongsTo(SoleTutor, {
    foreignKey: "owner_id",
    constraints: false,
    scope: { owner_type: "sole_tutor" },
    as: "soleTutorOwner",
  });

  Courses.belongsTo(Organization, {
    foreignKey: "owner_id",
    constraints: false,
    scope: { owner_type: "organization" },
    as: "organizationOwner",
  });

  // Marketplace Transaction associations
  // Courses -> Marketplace Transactions (One-to-Many)
  Courses.hasMany(MarketplaceTransaction, {
    foreignKey: "course_id",
    as: "marketplaceTransactions",
  });
  MarketplaceTransaction.belongsTo(Courses, {
    foreignKey: "course_id",
    as: "course",
  });

  // Students -> Marketplace Transactions (One-to-Many)
  Students.hasMany(MarketplaceTransaction, {
    foreignKey: "student_id",
    as: "marketplacePurchases",
  });
  MarketplaceTransaction.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Sole Tutor -> Marketplace Transactions (One-to-Many)
  SoleTutor.hasMany(MarketplaceTransaction, {
    foreignKey: "owner_id",
    constraints: false,
    scope: { owner_type: "sole_tutor" },
    as: "transactions",
  });

  // Organization -> Marketplace Transactions (One-to-Many)
  Organization.hasMany(MarketplaceTransaction, {
    foreignKey: "owner_id",
    constraints: false,
    scope: { owner_type: "organization" },
    as: "transactions",
  });

  // Marketplace Transaction -> WSP Commission (One-to-One)
  MarketplaceTransaction.hasOne(WspCommission, {
    foreignKey: "transaction_id",
    as: "wspCommission",
  });
  WspCommission.belongsTo(MarketplaceTransaction, {
    foreignKey: "transaction_id",
    as: "transaction",
  });

  // E-Books associations
  // Sole Tutor -> E-Books (One-to-Many)
  // Note: Using constraints: false because owner_type is on EBooks, not SoleTutor
  SoleTutor.hasMany(EBooks, {
    foreignKey: "owner_id",
    constraints: false,
    as: "ebooks",
  });
  EBooks.belongsTo(SoleTutor, {
    foreignKey: "owner_id",
    constraints: false,
    as: "soleTutor",
  });

  // Organization -> E-Books (One-to-Many)
  // Note: Using constraints: false because owner_type is on EBooks, not Organization
  Organization.hasMany(EBooks, {
    foreignKey: "owner_id",
    constraints: false,
    as: "ebooks",
  });
  EBooks.belongsTo(Organization, {
    foreignKey: "owner_id",
    constraints: false,
    as: "organization",
  });

  // Students -> E-Book Purchases (One-to-Many)
  Students.hasMany(EBookPurchase, {
    foreignKey: "student_id",
    as: "ebookPurchases",
  });
  EBookPurchase.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // E-Books -> E-Book Purchases (One-to-Many)
  EBooks.hasMany(EBookPurchase, {
    foreignKey: "ebook_id",
    as: "purchases",
  });
  EBookPurchase.belongsTo(EBooks, {
    foreignKey: "ebook_id",
    as: "ebook",
  });

  // Sole Tutor -> E-Book Purchases (One-to-Many)
  SoleTutor.hasMany(EBookPurchase, {
    foreignKey: "owner_id",
    constraints: false,
    scope: { owner_type: "sole_tutor" },
    as: "ebookTransactions",
  });

  // Organization -> E-Book Purchases (One-to-Many)
  Organization.hasMany(EBookPurchase, {
    foreignKey: "owner_id",
    constraints: false,
    scope: { owner_type: "organization" },
    as: "ebookTransactions",
  });

  // ============================================
  // DIGITAL DOWNLOADS ASSOCIATIONS
  // ============================================

  // Sole Tutor -> Digital Downloads (One-to-Many)
  SoleTutor.hasMany(DigitalDownloads, {
    foreignKey: "owner_id",
    constraints: false,
    as: "digitalDownloads",
  });
  DigitalDownloads.belongsTo(SoleTutor, {
    foreignKey: "owner_id",
    constraints: false,
    as: "soleTutor",
  });

  // Organization -> Digital Downloads (One-to-Many)
  Organization.hasMany(DigitalDownloads, {
    foreignKey: "owner_id",
    constraints: false,
    as: "digitalDownloads",
  });
  DigitalDownloads.belongsTo(Organization, {
    foreignKey: "owner_id",
    constraints: false,
    as: "organization",
  });

  // Students -> Digital Download Purchases (One-to-Many)
  Students.hasMany(DigitalDownloadPurchase, {
    foreignKey: "student_id",
    as: "digitalDownloadPurchases",
  });
  DigitalDownloadPurchase.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Digital Downloads -> Digital Download Purchases (One-to-Many)
  DigitalDownloads.hasMany(DigitalDownloadPurchase, {
    foreignKey: "digital_download_id",
    as: "purchases",
  });
  DigitalDownloadPurchase.belongsTo(DigitalDownloads, {
    foreignKey: "digital_download_id",
    as: "digitalDownload",
  });

  // Sole Tutor -> Digital Download Purchases (One-to-Many)
  SoleTutor.hasMany(DigitalDownloadPurchase, {
    foreignKey: "owner_id",
    constraints: false,
    scope: { owner_type: "sole_tutor" },
    as: "digitalDownloadTransactions",
  });

  // Organization -> Digital Download Purchases (One-to-Many)
  Organization.hasMany(DigitalDownloadPurchase, {
    foreignKey: "owner_id",
    constraints: false,
    scope: { owner_type: "organization" },
    as: "digitalDownloadTransactions",
  });

  // ============================================
  // COACHING & SUBSCRIPTION ASSOCIATIONS
  // ============================================

  // Tutor Subscriptions
  SoleTutor.hasMany(TutorSubscription, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "sole_tutor" },
    as: "subscriptions",
  });

  Organization.hasMany(TutorSubscription, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "organization" },
    as: "subscriptions",
  });

  // Coaching Sessions
  SoleTutor.hasMany(CoachingSession, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "sole_tutor" },
    as: "coachingSessions",
  });

  Organization.hasMany(CoachingSession, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "organization" },
    as: "coachingSessions",
  });

  // Coaching Session Ownership (for browsing)
  CoachingSession.belongsTo(SoleTutor, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "sole_tutor" },
    as: "soleTutorOwner",
  });

  CoachingSession.belongsTo(Organization, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "organization" },
    as: "organizationOwner",
  });

  // Coaching Session Participants
  CoachingSession.hasMany(CoachingParticipant, {
    foreignKey: "session_id",
    as: "participants",
  });

  CoachingParticipant.belongsTo(CoachingSession, {
    foreignKey: "session_id",
    as: "session",
  });

  // Coaching Session Purchases
  CoachingSession.hasMany(CoachingSessionPurchase, {
    foreignKey: "session_id",
    as: "purchases",
  });

  CoachingSessionPurchase.belongsTo(CoachingSession, {
    foreignKey: "session_id",
    as: "coachingSession",
  });

  CoachingSessionPurchase.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Coaching Hours Balance
  SoleTutor.hasOne(CoachingHoursBalance, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "sole_tutor" },
    as: "coachingHoursBalance",
  });

  Organization.hasOne(CoachingHoursBalance, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "organization" },
    as: "coachingHoursBalance",
  });

  // Coaching Hours Purchases
  SoleTutor.hasMany(CoachingHoursPurchase, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "sole_tutor" },
    as: "coachingHoursPurchases",
  });

  Organization.hasMany(CoachingHoursPurchase, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "organization" },
    as: "coachingHoursPurchases",
  });

  // Tutor Bank Accounts
  SoleTutor.hasMany(TutorBankAccount, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "sole_tutor" },
    as: "bankAccounts",
  });

  Organization.hasMany(TutorBankAccount, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "organization" },
    as: "bankAccounts",
  });

  // Tutor Payouts
  SoleTutor.hasMany(TutorPayout, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "sole_tutor" },
    as: "payouts",
  });

  Organization.hasMany(TutorPayout, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "organization" },
    as: "payouts",
  });

  TutorPayout.belongsTo(TutorBankAccount, {
    foreignKey: "bank_account_id",
    as: "bankAccount",
  });

  // Coaching Scheduling Messages
  CoachingSession.hasMany(CoachingSchedulingMessage, {
    foreignKey: "session_id",
    as: "schedulingMessages",
  });
  CoachingSchedulingMessage.belongsTo(CoachingSession, {
    foreignKey: "session_id",
    as: "session",
  });

  // Communities
  SoleTutor.hasMany(Community, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "sole_tutor" },
    as: "communities",
  });
  Organization.hasMany(Community, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "organization" },
    as: "communities",
  });

  // Community Members
  Community.hasMany(CommunityMember, {
    foreignKey: "community_id",
    as: "members",
  });
  CommunityMember.belongsTo(Community, {
    foreignKey: "community_id",
    as: "community",
  });
  CommunityMember.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Community Subscriptions
  Community.hasMany(CommunitySubscription, {
    foreignKey: "community_id",
    as: "subscriptions",
  });
  CommunitySubscription.belongsTo(Community, {
    foreignKey: "community_id",
    as: "community",
  });
  CommunitySubscription.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Community Posts
  Community.hasMany(CommunityPost, {
    foreignKey: "community_id",
    as: "posts",
  });
  CommunityPost.belongsTo(Community, {
    foreignKey: "community_id",
    as: "community",
  });
  CommunityPost.belongsTo(Students, {
    foreignKey: "author_id",
    as: "author",
  });

  // Community Comments
  CommunityPost.hasMany(CommunityComment, {
    foreignKey: "post_id",
    as: "comments",
  });
  CommunityComment.belongsTo(CommunityPost, {
    foreignKey: "post_id",
    as: "post",
  });
  CommunityComment.belongsTo(Students, {
    foreignKey: "author_id",
    as: "author",
  });
  CommunityComment.belongsTo(CommunityComment, {
    foreignKey: "parent_comment_id",
    as: "parentComment",
  });
  CommunityComment.hasMany(CommunityComment, {
    foreignKey: "parent_comment_id",
    as: "replies",
  });

  // Community Reactions
  CommunityPost.hasMany(CommunityReaction, {
    foreignKey: "post_id",
    as: "reactions",
  });
  CommunityComment.hasMany(CommunityReaction, {
    foreignKey: "comment_id",
    as: "reactions",
  });
  CommunityReaction.belongsTo(CommunityPost, {
    foreignKey: "post_id",
    as: "post",
  });
  CommunityReaction.belongsTo(CommunityComment, {
    foreignKey: "comment_id",
    as: "comment",
  });
  CommunityReaction.belongsTo(Students, {
    foreignKey: "user_id",
    as: "user",
    constraints: false,
  });

  // Community Files
  Community.hasMany(CommunityFile, {
    foreignKey: "community_id",
    as: "files",
  });
  CommunityFile.belongsTo(Community, {
    foreignKey: "community_id",
    as: "community",
  });
  CommunityFile.belongsTo(Students, {
    foreignKey: "uploaded_by",
    as: "uploader",
  });

  // Community Purchases
  Community.hasMany(CommunityPurchase, {
    foreignKey: "community_id",
    as: "purchases",
  });
  CommunityPurchase.belongsTo(Community, {
    foreignKey: "community_id",
    as: "community",
  });
  CommunityPurchase.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Community Audio Sessions
  Community.hasMany(CommunityAudioSession, {
    foreignKey: "community_id",
    as: "audioSessions",
  });
  CommunityAudioSession.belongsTo(Community, {
    foreignKey: "community_id",
    as: "community",
  });

  // ============================================
  // MEMBERSHIP ASSOCIATIONS
  // ============================================

  // Membership -> Tutor (polymorphic)
  Membership.belongsTo(SoleTutor, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "sole_tutor" },
    as: "soleTutor",
  });
  Membership.belongsTo(Organization, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "organization" },
    as: "organization",
  });
  SoleTutor.hasMany(Membership, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "sole_tutor" },
    as: "memberships",
  });
  Organization.hasMany(Membership, {
    foreignKey: "tutor_id",
    constraints: false,
    scope: { tutor_type: "organization" },
    as: "memberships",
  });

  // Membership -> Membership Products
  Membership.hasMany(MembershipProduct, {
    foreignKey: "membership_id",
    as: "products",
  });
  MembershipProduct.belongsTo(Membership, {
    foreignKey: "membership_id",
    as: "membership",
  });

  // Membership -> Subscriptions
  Membership.hasMany(MembershipSubscription, {
    foreignKey: "membership_id",
    as: "subscriptions",
  });
  MembershipSubscription.belongsTo(Membership, {
    foreignKey: "membership_id",
    as: "membership",
  });
  MembershipSubscription.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Membership Subscription -> Payments
  MembershipSubscription.hasMany(MembershipPayment, {
    foreignKey: "subscription_id",
    as: "payments",
  });
  MembershipPayment.belongsTo(MembershipSubscription, {
    foreignKey: "subscription_id",
    as: "subscription",
  });
  MembershipPayment.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });
  MembershipPayment.belongsTo(Membership, {
    foreignKey: "membership_id",
    as: "membership",
  });

  // Students -> Membership Subscriptions
  Students.hasMany(MembershipSubscription, {
    foreignKey: "student_id",
    as: "membershipSubscriptions",
  });

  // ============================================
  // LEARNER ACTIVITY TRACKING ASSOCIATIONS
  // ============================================

  // Students -> Learner Activity Logs
  Students.hasMany(LearnerActivityLog, {
    foreignKey: "student_id",
    as: "activityLogs",
  });
  LearnerActivityLog.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Courses -> Learner Activity Logs
  Courses.hasMany(LearnerActivityLog, {
    foreignKey: "course_id",
    as: "learnerActivities",
  });
  LearnerActivityLog.belongsTo(Courses, {
    foreignKey: "course_id",
    as: "course",
  });

  // Students -> Course Progress
  Students.hasMany(CourseProgress, {
    foreignKey: "student_id",
    as: "courseProgress",
  });
  CourseProgress.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });

  // Courses -> Course Progress
  Courses.hasMany(CourseProgress, {
    foreignKey: "course_id",
    as: "studentProgress",
  });
  CourseProgress.belongsTo(Courses, {
    foreignKey: "course_id",
    as: "course",
  });

  // Students -> Login History
  Students.hasMany(LearnerLoginHistory, {
    foreignKey: "student_id",
    as: "loginHistory",
  });
  LearnerLoginHistory.belongsTo(Students, {
    foreignKey: "student_id",
    as: "student",
  });
};
