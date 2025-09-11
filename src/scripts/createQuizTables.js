import { dbLibrary } from "../database/database.js";

const sql = `
BEGIN;

-- Create quiz main table
CREATE TABLE IF NOT EXISTS quiz (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructions TEXT,
  course_id INTEGER NOT NULL,
  attempts_allowed INTEGER NOT NULL DEFAULT 1,
  show_results BOOLEAN NOT NULL DEFAULT true,
  shuffle_questions BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create quiz questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay')),
  points INTEGER NOT NULL DEFAULT 1,
  correct_answer TEXT,
  image_url VARCHAR(1000),
  video_url VARCHAR(1000),
  "order" INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_quiz_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quiz(id) ON DELETE CASCADE
);

-- Create quiz options table (for multiple choice questions)
CREATE TABLE IF NOT EXISTS quiz_options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_quiz_options_question FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
);

-- Create quiz attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  total_score DECIMAL(5,2),
  max_possible_score DECIMAL(5,2),
  started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMP WITHOUT TIME ZONE,
  graded_at TIMESTAMP WITHOUT TIME ZONE,
  graded_by INTEGER,
  CONSTRAINT fk_quiz_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES quiz(id) ON DELETE CASCADE
);

-- Create quiz answers table
CREATE TABLE IF NOT EXISTS quiz_answers (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  answer_text TEXT,
  selected_option_id INTEGER,
  points_earned DECIMAL(5,2),
  is_correct BOOLEAN,
  answered_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  graded_at TIMESTAMP WITHOUT TIME ZONE,
  feedback TEXT,
  CONSTRAINT fk_quiz_answers_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_answers_question FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_answers_option FOREIGN KEY (selected_option_id) REFERENCES quiz_options(id) ON DELETE SET NULL,
  CONSTRAINT uq_quiz_answers UNIQUE (attempt_id, question_id)
);

-- Skip indexes for now - will add later if needed

COMMIT;
`;

(async () => {
  try {
    console.log("🔧 Creating quiz tables in Library DB...");
    await dbLibrary.query(sql);
    console.log("✅ Quiz tables created successfully!");
    console.log("📋 Created tables: quiz, quiz_questions, quiz_options, quiz_attempts, quiz_answers");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    await dbLibrary.close();
    process.exit(0);
  }
})();
