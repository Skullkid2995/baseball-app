-- Add lineup templates table
-- Run this in your Supabase SQL Editor

-- Create lineup_templates table
CREATE TABLE IF NOT EXISTS lineup_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lineup_template_players table to store the batting order and positions
CREATE TABLE IF NOT EXISTS lineup_template_players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES lineup_templates(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    batting_order INTEGER NOT NULL CHECK (batting_order >= 1 AND batting_order <= 9),
    position VARCHAR(20) NOT NULL CHECK (position IN ('P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lineup_templates_name ON lineup_templates(name);
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

-- Add comment to explain the tables
COMMENT ON TABLE lineup_templates IS 'Stores lineup template definitions';
COMMENT ON TABLE lineup_template_players IS 'Stores player assignments for each lineup template including batting order and position';
COMMENT ON COLUMN lineup_template_players.batting_order IS 'Batting order position (1-9)';
COMMENT ON COLUMN lineup_template_players.position IS 'Fielding position (P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH)';

