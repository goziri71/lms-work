-- Add max_attempts column to exams table
-- Run this on the Library database

ALTER TABLE exams 
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;

COMMENT ON COLUMN exams.max_attempts IS 'Maximum number of attempts allowed per student (null = unlimited)';

-- Update existing exams to have 3 attempts by default
UPDATE exams 
SET max_attempts = 3 
WHERE max_attempts IS NULL;

