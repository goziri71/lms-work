-- ======================================================================
-- DATABASE INDEXES FOR PERFORMANCE OPTIMIZATION
-- Run this script on BOTH databases (LMS and Library)
-- ======================================================================

-- ======================================================================
-- EXAM SYSTEM INDEXES (Library Database)
-- ======================================================================

-- Exams table indexes
CREATE INDEX IF NOT EXISTS idx_exams_course_id ON exams(course_id);
CREATE INDEX IF NOT EXISTS idx_exams_visibility ON exams(visibility);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON exams(created_by);
CREATE INDEX IF NOT EXISTS idx_exams_academic_year_semester ON exams(academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_exams_start_at ON exams(start_at);
CREATE INDEX IF NOT EXISTS idx_exams_end_at ON exams(end_at);

-- Exam attempts table indexes
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON exam_attempts(status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_submitted_at ON exam_attempts(submitted_at);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_exam ON exam_attempts(student_id, exam_id);

-- Exam items table indexes
CREATE INDEX IF NOT EXISTS idx_exam_items_exam_id ON exam_items(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_items_attempt_id ON exam_items(attempt_id);
CREATE INDEX IF NOT EXISTS idx_exam_items_question_bank_id ON exam_items(question_bank_id);
CREATE INDEX IF NOT EXISTS idx_exam_items_exam_attempt ON exam_items(exam_id, attempt_id);

-- Question bank indexes
CREATE INDEX IF NOT EXISTS idx_question_bank_course_id ON question_bank(course_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_type ON question_bank(question_type);
CREATE INDEX IF NOT EXISTS idx_question_bank_status ON question_bank(status);
CREATE INDEX IF NOT EXISTS idx_question_bank_difficulty ON question_bank(difficulty);
CREATE INDEX IF NOT EXISTS idx_question_bank_created_by ON question_bank(created_by);
CREATE INDEX IF NOT EXISTS idx_question_bank_course_type_status ON question_bank(course_id, question_type, status);

-- Question objective indexes
CREATE INDEX IF NOT EXISTS idx_question_objective_bank_id ON question_objective(question_bank_id);

-- Question theory indexes
CREATE INDEX IF NOT EXISTS idx_question_theory_bank_id ON question_theory(question_bank_id);

-- Exam answer objective indexes
CREATE INDEX IF NOT EXISTS idx_exam_answer_obj_attempt_id ON exam_answer_objective(attempt_id);
CREATE INDEX IF NOT EXISTS idx_exam_answer_obj_exam_item_id ON exam_answer_objective(exam_item_id);
CREATE INDEX IF NOT EXISTS idx_exam_answer_obj_is_correct ON exam_answer_objective(is_correct);

-- Exam answer theory indexes
CREATE INDEX IF NOT EXISTS idx_exam_answer_theory_attempt_id ON exam_answer_theory(attempt_id);
CREATE INDEX IF NOT EXISTS idx_exam_answer_theory_exam_item_id ON exam_answer_theory(exam_item_id);
CREATE INDEX IF NOT EXISTS idx_exam_answer_theory_graded_by ON exam_answer_theory(graded_by);
CREATE INDEX IF NOT EXISTS idx_exam_answer_theory_graded_at ON exam_answer_theory(graded_at);

-- ======================================================================
-- COURSE SYSTEM INDEXES (LMS Database)
-- ======================================================================

-- Course registration indexes
CREATE INDEX IF NOT EXISTS idx_course_reg_student_id ON course_reg(student_id);
CREATE INDEX IF NOT EXISTS idx_course_reg_course_id ON course_reg(course_id);
CREATE INDEX IF NOT EXISTS idx_course_reg_academic_year ON course_reg(academic_year);
CREATE INDEX IF NOT EXISTS idx_course_reg_semester ON course_reg(semester);
CREATE INDEX IF NOT EXISTS idx_course_reg_student_course ON course_reg(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_course_reg_student_year_sem ON course_reg(student_id, academic_year, semester);

-- Courses indexes
CREATE INDEX IF NOT EXISTS idx_courses_staff_id ON courses(staff_id);
CREATE INDEX IF NOT EXISTS idx_courses_course_level ON courses(course_level);
CREATE INDEX IF NOT EXISTS idx_courses_semester ON courses(semester);

-- Students indexes (if not exists)
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_matric_number ON students(matric_number);
CREATE INDEX IF NOT EXISTS idx_students_level ON students(level);

-- Staff indexes (if not exists)
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);

-- ======================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ======================================================================

-- For exam listing with filters
CREATE INDEX IF NOT EXISTS idx_exams_course_year_sem_vis ON exams(course_id, academic_year, semester, visibility);

-- For student exam access
CREATE INDEX IF NOT EXISTS idx_exams_vis_start_end ON exams(visibility, start_at, end_at) WHERE visibility = 'published';

-- For grading queries
CREATE INDEX IF NOT EXISTS idx_attempts_exam_status_submit ON exam_attempts(exam_id, status, submitted_at);

-- For question selection
CREATE INDEX IF NOT EXISTS idx_qbank_course_type_status_diff ON question_bank(course_id, question_type, status, difficulty) WHERE status = 'approved';

-- ======================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ======================================================================

ANALYZE exams;
ANALYZE exam_attempts;
ANALYZE exam_items;
ANALYZE question_bank;
ANALYZE question_objective;
ANALYZE question_theory;
ANALYZE exam_answer_objective;
ANALYZE exam_answer_theory;
ANALYZE course_reg;
ANALYZE courses;
ANALYZE students;
ANALYZE staff;

-- ======================================================================
-- VERIFY INDEXES CREATED
-- ======================================================================

-- Run these queries to verify indexes:
-- SELECT schemaname, tablename, indexname FROM pg_indexes WHERE tablename LIKE 'exam%' OR tablename LIKE 'question%';
-- SELECT schemaname, tablename, indexname FROM pg_indexes WHERE tablename IN ('course_reg', 'courses', 'students', 'staff');

