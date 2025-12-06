-- Add opponent_lineup_template_id column to games table
-- This column stores the lineup template ID for the opponent team

ALTER TABLE games
ADD COLUMN IF NOT EXISTS opponent_lineup_template_id UUID REFERENCES lineup_templates(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_games_opponent_lineup_template ON games(opponent_lineup_template_id);

-- Add comment to document the column
COMMENT ON COLUMN games.opponent_lineup_template_id IS 'Lineup template ID for the opponent/away team';

