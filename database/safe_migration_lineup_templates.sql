-- Safe migration script that preserves existing data
-- This script adds new columns without dropping existing tables

-- Add lineup_template_id to games table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'lineup_template_id'
    ) THEN
        ALTER TABLE games ADD COLUMN lineup_template_id UUID REFERENCES lineup_templates(id);
    END IF;
END $$;

-- Create lineup_templates table if it doesn't exist
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

-- Create lineup_template_players table if it doesn't exist
CREATE TABLE IF NOT EXISTS lineup_template_players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES lineup_templates(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    batting_order INTEGER NOT NULL CHECK (batting_order >= 1 AND batting_order <= 10),
    position VARCHAR(20) NOT NULL CHECK (position IN ('P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_lineup_templates_team ON lineup_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_lineup_template_players_template ON lineup_template_players(template_id);
CREATE INDEX IF NOT EXISTS idx_lineup_template_players_player ON lineup_template_players(player_id);
CREATE INDEX IF NOT EXISTS idx_lineup_template_players_order ON lineup_template_players(template_id, batting_order);

-- Add unique constraints (only if they don't exist)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_batting_order 
ON lineup_template_players(template_id, batting_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_position 
ON lineup_template_players(template_id, position);

-- Create updated_at trigger for lineup_templates (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_lineup_templates_updated_at'
    ) THEN
        CREATE TRIGGER update_lineup_templates_updated_at BEFORE UPDATE ON lineup_templates
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;


























