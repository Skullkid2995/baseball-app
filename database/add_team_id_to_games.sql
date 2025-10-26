-- Add team_id field to games table to link games to specific teams
-- This allows us to use the team's lineup for the scorebook

-- Add team_id field to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- Add comment to explain the team_id field
COMMENT ON COLUMN games.team_id IS 'Reference to the team whose offensive stats are being tracked in this game';

-- Create index for team_id field
CREATE INDEX IF NOT EXISTS idx_games_team_id ON games(team_id);

-- Update existing games to have a default team (you may need to set this manually)
-- UPDATE games SET team_id = (SELECT id FROM teams LIMIT 1) WHERE team_id IS NULL;

