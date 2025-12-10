-- =====================================================
-- MIGRATION: Add Expiration Control to Notice Table
-- =====================================================
-- This script adds new columns to the notice table for
-- expiration control and audience targeting.
-- =====================================================

BEGIN;

-- Add expires_at column (nullable - null means no expiration if is_permanent is true)
ALTER TABLE notice
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL;

-- Add is_permanent column (default false)
ALTER TABLE notice
ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN NOT NULL DEFAULT false;

-- Add status column (default 'active')
-- First create the enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE notice_status_enum AS ENUM ('active', 'expired', 'draft');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE notice
ADD COLUMN IF NOT EXISTS status notice_status_enum NOT NULL DEFAULT 'active';

-- Add target_audience column (default 'all')
-- First create the enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE notice_audience_enum AS ENUM ('all', 'students', 'staff', 'both');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE notice
ADD COLUMN IF NOT EXISTS target_audience notice_audience_enum NOT NULL DEFAULT 'all';

-- Add comments for documentation
COMMENT ON COLUMN notice.expires_at IS 'When the notice expires. Null if permanent.';
COMMENT ON COLUMN notice.is_permanent IS 'If true, notice never expires regardless of expires_at';
COMMENT ON COLUMN notice.status IS 'active = visible, expired = hidden, draft = not published';
COMMENT ON COLUMN notice.target_audience IS 'Who can see this notice: all, students only, staff only, or both';

-- Update existing notices to be active and permanent (backward compatibility)
UPDATE notice
SET 
  status = 'active',
  is_permanent = true,
  target_audience = 'all'
WHERE status IS NULL OR is_permanent IS NULL OR target_audience IS NULL;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES (Run after migration)
-- =====================================================

-- Check that all columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'notice'
ORDER BY ordinal_position;

-- Check existing notices
SELECT 
  id, 
  title, 
  status, 
  is_permanent, 
  expires_at, 
  target_audience,
  course_id
FROM notice
LIMIT 10;

