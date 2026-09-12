-- Add lineup field to teams table
-- This stores the batting order as an array of player IDs

-- Add lineup field to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS lineup UUID[] DEFAULT '{}';

-- Add comment to explain the lineup field
COMMENT ON COLUMN teams.lineup IS 'Array of player IDs representing the batting order (1st through 9th)';

-- Create index for lineup field
CREATE INDEX IF NOT EXISTS idx_teams_lineup ON teams USING GIN (lineup);

