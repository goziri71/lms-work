-- Fix coaching_sessions.currency column to allow NULL values
-- This is needed because free sessions don't require a currency

-- Check current column definition
SELECT 
    column_name, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'coaching_sessions' 
AND column_name = 'currency';

-- Alter column to allow NULL
ALTER TABLE coaching_sessions
ALTER COLUMN currency DROP NOT NULL;
