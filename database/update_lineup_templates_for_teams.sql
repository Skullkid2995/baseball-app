-- Update lineup templates to be linked to teams (one template per team)
-- Run this in your Supabase SQL Editor

-- Drop existing tables if they exist
DROP TABLE IF EXISTS lineup_template_players CASCADE;
DROP TABLE IF EXISTS lineup_templates CASCADE;

-- Create lineup_templates table linked to teams
CREATE TABLE IF NOT EXISTS lineup_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'Default Lineup',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure only one template per team
    UNIQUE(team_id)
);

-- Create lineup_template_players table to store the batting order and positions
CREATE TABLE IF NOT EXISTS lineup_template_players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES lineup_templates(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    batting_order INTEGER NOT NULL CHECK (batting_order >= 1 AND batting_order <= 10),
    position VARCHAR(20) NOT NULL CHECK (position IN ('P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lineup_templates_team ON lineup_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_lineup_template_players_template ON lineup_template_players(template_id);
CREATE INDEX IF NOT EXISTS idx_lineup_template_players_player ON lineup_template_players(player_id);
CREATE INDEX IF NOT EXISTS idx_lineup_template_players_order ON lineup_template_players(template_id, batting_order);

-- Add unique constraint to ensure no duplicate batting orders in the same template
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_batting_order 
ON lineup_template_players(template_id, batting_order);

-- Add unique constraint to ensure no duplicate positions in the same template
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_position 
ON lineup_template_players(template_id, position);

-- Create updated_at trigger for lineup_templates
CREATE TRIGGER update_lineup_templates_updated_at BEFORE UPDATE ON lineup_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add lineup_template_id to games table to link games to lineup templates
ALTER TABLE games ADD COLUMN IF NOT EXISTS lineup_template_id UUID REFERENCES lineup_templates(id);

-- Add comment to explain the tables
COMMENT ON TABLE lineup_templates IS 'Stores lineup template definitions - one per team';
COMMENT ON TABLE lineup_template_players IS 'Stores player assignments for each lineup template including batting order and position';
COMMENT ON COLUMN lineup_template_players.batting_order IS 'Batting order position (1-10)';
COMMENT ON COLUMN lineup_template_players.position IS 'Fielding position (P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH)';
COMMENT ON COLUMN games.lineup_template_id IS 'Links game to the lineup template used for this game';
