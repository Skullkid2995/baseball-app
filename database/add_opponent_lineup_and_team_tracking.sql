-- Add opponent lineup template and team tracking to games and at_bats
-- Run this in your Supabase SQL Editor

-- Add opponent_lineup_template_id to games table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'opponent_lineup_template_id'
    ) THEN
        ALTER TABLE games ADD COLUMN opponent_lineup_template_id UUID REFERENCES lineup_templates(id);
    END IF;
END $$;

-- Add team_side field to at_bats to track which team is batting
-- 'home' = our team, 'opponent' = opponent team
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'at_bats' AND column_name = 'team_side'
    ) THEN
        ALTER TABLE at_bats ADD COLUMN team_side VARCHAR(10) DEFAULT 'home' CHECK (team_side IN ('home', 'opponent'));
    END IF;
END $$;

-- Add index for team_side for better query performance
CREATE INDEX IF NOT EXISTS idx_at_bats_team_side ON at_bats(game_id, team_side, inning);

COMMENT ON COLUMN games.opponent_lineup_template_id IS 'Lineup template for the opponent team';
COMMENT ON COLUMN at_bats.team_side IS 'Which team is batting: home (our team) or opponent';

