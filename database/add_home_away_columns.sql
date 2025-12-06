-- Add home_team_id and away_team_id columns to games table
-- These columns store which team is home and which is away for each game

ALTER TABLE games
ADD COLUMN IF NOT EXISTS home_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE games
ADD COLUMN IF NOT EXISTS away_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_games_home_team_id ON games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team_id ON games(away_team_id);

-- Add comments to document the columns
COMMENT ON COLUMN games.home_team_id IS 'Team ID for the home team (bats last in each inning)';
COMMENT ON COLUMN games.away_team_id IS 'Team ID for the away team (bats first in each inning)';

