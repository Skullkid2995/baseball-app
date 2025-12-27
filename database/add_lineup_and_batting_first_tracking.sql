-- Add fields to track lineup selection and home/away team selection
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
    END IF;
END $$;

-- Add comments to explain the fields
COMMENT ON COLUMN games.lineup_template_id IS 'Lineup template for our team - NULL means lineup not selected yet';
COMMENT ON COLUMN games.opponent_lineup_template_id IS 'Lineup template for the opponent team - NULL means lineup not selected yet';
COMMENT ON COLUMN games.batting_first IS 'Which team bats first: home (our team) or opponent';

