-- Add batting_first column to games table
-- Run this in your Supabase SQL Editor

-- Add batting_first field to games table to track which team bats first
-- 'home' = our team bats first, 'opponent' = opponent bats first
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'batting_first'
    ) THEN
        ALTER TABLE games ADD COLUMN batting_first VARCHAR(10) CHECK (batting_first IN ('home', 'opponent'));
        
        -- Add comment to explain the field
        COMMENT ON COLUMN games.batting_first IS 'Which team bats first: home (our team) or opponent';
    END IF;
END $$;

